package docker

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
	imagetypes "github.com/docker/docker/api/types/image"
	"github.com/docker/docker/client"
)

type Client struct {
	cli        *client.Client
	registryOrg string
}

type ServiceInfo struct {
	Name    string `json:"name"`
	ID      string `json:"id"`
	Image   string `json:"image"`
	Tag     string `json:"tag"`
	Status  string `json:"status"` // "running", "stopped", "restarting", "error"
	State   string `json:"state"`
	Created string `json:"created"`
	Uptime  string `json:"uptime,omitempty"`
	Ports   string `json:"ports,omitempty"`
}

type VersionInfo struct {
	Service          string `json:"service"`
	InstalledTag     string `json:"installed_tag"`
	AvailableTag     string `json:"available_tag,omitempty"`
	UpdateAvailable  bool   `json:"update_available"`
	ReleaseChannel   string `json:"release_channel"`
}

func New(socketPath, registryOrg string) (*Client, error) {
	cli, err := client.NewClientWithOpts(
		client.WithHost("unix://"+socketPath),
		client.WithAPIVersionNegotiation(),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create Docker client: %w", err)
	}

	// Verify connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err = cli.Ping(ctx)
	if err != nil {
		log.Printf("[DOCKER] Warning: cannot connect to Docker socket: %v", err)
	} else {
		log.Printf("[DOCKER] Connected to Docker daemon via %s", socketPath)
	}

	return &Client{cli: cli, registryOrg: registryOrg}, nil
}

// ListServices returns all containers with their status
func (c *Client) ListServices(ctx context.Context) ([]ServiceInfo, error) {
	containers, err := c.cli.ContainerList(ctx, container.ListOptions{
		All: true,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list containers: %w", err)
	}

	services := make([]ServiceInfo, 0, len(containers))
	for _, ctr := range containers {
		name := strings.TrimPrefix(ctr.Names[0], "/")
		image, tag := parseImageTag(ctr.Image)

		svc := ServiceInfo{
			Name:    name,
			ID:      ctr.ID[:12],
			Image:   image,
			Tag:     tag,
			Status:  normalizeState(ctr.State),
			State:   ctr.Status,
			Created: time.Unix(ctr.Created, 0).Format(time.RFC3339),
		}

		if ctr.State == "running" {
			created := time.Unix(ctr.Created, 0)
			svc.Uptime = formatDuration(time.Since(created))
		}

		// Format ports
		if len(ctr.Ports) > 0 {
			ports := make([]string, 0)
			for _, p := range ctr.Ports {
				if p.PublicPort > 0 {
					ports = append(ports, fmt.Sprintf("%d:%d", p.PublicPort, p.PrivatePort))
				}
			}
			svc.Ports = strings.Join(ports, ", ")
		}

		services = append(services, svc)
	}

	return services, nil
}

// InspectService returns detailed information about a container
func (c *Client) InspectService(ctx context.Context, name string) (*ServiceInfo, map[string]interface{}, error) {
	ctr, err := c.cli.ContainerInspect(ctx, name)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to inspect container %s: %w", name, err)
	}

	image, tag := parseImageTag(ctr.Config.Image)
	svc := &ServiceInfo{
		Name:    strings.TrimPrefix(ctr.Name, "/"),
		ID:      ctr.ID[:12],
		Image:   image,
		Tag:     tag,
		Status:  normalizeState(ctr.State.Status),
		State:   ctr.State.Status,
		Created: ctr.Created,
	}

	details := map[string]interface{}{
		"env":          ctr.Config.Env,
		"mounts":       ctr.Mounts,
		"network_mode": ctr.HostConfig.NetworkMode,
		"restart":      ctr.HostConfig.RestartPolicy,
		"health":       ctr.State.Health,
	}

	return svc, details, nil
}

// RestartService restarts a container
func (c *Client) RestartService(ctx context.Context, name string) error {
	timeout := 30
	return c.cli.ContainerRestart(ctx, name, container.StopOptions{Timeout: &timeout})
}

// GetLogs returns container logs
func (c *Client) GetLogs(ctx context.Context, name string, lines int, since string) (string, error) {
	opts := container.LogsOptions{
		ShowStdout: true,
		ShowStderr: true,
		Timestamps: true,
		Tail:       fmt.Sprintf("%d", lines),
	}
	if since != "" {
		opts.Since = since
	}

	reader, err := c.cli.ContainerLogs(ctx, name, opts)
	if err != nil {
		return "", fmt.Errorf("failed to get logs for %s: %w", name, err)
	}
	defer reader.Close()

	data, err := io.ReadAll(reader)
	if err != nil {
		return "", err
	}

	// Strip Docker log header bytes (8-byte prefix per line)
	return stripDockerLogHeaders(string(data)), nil
}

// StreamLogs returns a log reader for WebSocket streaming
func (c *Client) StreamLogs(ctx context.Context, name string) (io.ReadCloser, error) {
	return c.cli.ContainerLogs(ctx, name, container.LogsOptions{
		ShowStdout: true,
		ShowStderr: true,
		Timestamps: true,
		Follow:     true,
		Tail:       "50",
	})
}

// CheckUpdates checks Docker Hub for newer image versions
func (c *Client) CheckUpdates(ctx context.Context) ([]VersionInfo, error) {
	services, err := c.ListServices(ctx)
	if err != nil {
		return nil, err
	}

	versions := make([]VersionInfo, 0)
	for _, svc := range services {
		if !strings.Contains(svc.Image, c.registryOrg+"/") {
			continue // Skip non-essensys images
		}

		v := VersionInfo{
			Service:        svc.Name,
			InstalledTag:   svc.Tag,
			ReleaseChannel: "stable",
		}

		// Query Docker Hub for latest tag
		latest, err := c.getLatestTag(svc.Image)
		if err != nil {
			log.Printf("[DOCKER] Failed to check updates for %s: %v", svc.Image, err)
		} else {
			v.AvailableTag = latest
			v.UpdateAvailable = latest != svc.Tag && latest != ""
		}

		versions = append(versions, v)
	}

	return versions, nil
}

// PullAndUpdate pulls a new image and recreates the container
func (c *Client) PullAndUpdate(ctx context.Context, name, newTag string) error {
	// Inspect current container to get config
	ctr, err := c.cli.ContainerInspect(ctx, name)
	if err != nil {
		return fmt.Errorf("failed to inspect %s: %w", name, err)
	}

	imgName, _ := parseImageTag(ctr.Config.Image)
	newImage := imgName + ":" + newTag

	// Pull new image
	log.Printf("[DOCKER] Pulling %s...", newImage)
	reader, err := c.cli.ImagePull(ctx, newImage, imagetypes.PullOptions{})
	if err != nil {
		return fmt.Errorf("failed to pull %s: %w", newImage, err)
	}
	io.Copy(io.Discard, reader)
	reader.Close()

	// Stop current container
	timeout := 30
	c.cli.ContainerStop(ctx, name, container.StopOptions{Timeout: &timeout})

	// Rename old container
	oldName := name + "_old_" + time.Now().Format("20060102150405")
	c.cli.ContainerRename(ctx, name, oldName)

	// Create new container with same config but new image
	ctr.Config.Image = newImage
	newCtr, err := c.cli.ContainerCreate(ctx, ctr.Config, ctr.HostConfig, nil, nil, name)
	if err != nil {
		// Rollback: rename old container back
		c.cli.ContainerRename(ctx, oldName, name)
		c.cli.ContainerStart(ctx, name, container.StartOptions{})
		return fmt.Errorf("failed to create new container %s: %w", name, err)
	}

	// Start new container
	if err := c.cli.ContainerStart(ctx, newCtr.ID, container.StartOptions{}); err != nil {
		// Rollback
		c.cli.ContainerRemove(ctx, newCtr.ID, container.RemoveOptions{Force: true})
		c.cli.ContainerRename(ctx, oldName, name)
		c.cli.ContainerStart(ctx, name, container.StartOptions{})
		return fmt.Errorf("failed to start new container: %w", err)
	}

	// Remove old container
	c.cli.ContainerRemove(ctx, oldName, container.RemoveOptions{Force: true})

	log.Printf("[DOCKER] Updated %s to %s", name, newTag)
	return nil
}

// RollbackService restores previous container image
func (c *Client) RollbackService(ctx context.Context, name string) (string, error) {
	// Get image history to find previous tag
	ctr, err := c.cli.ContainerInspect(ctx, name)
	if err != nil {
		return "", fmt.Errorf("failed to inspect %s: %w", name, err)
	}

	imgName, currentTag := parseImageTag(ctr.Config.Image)

	// List local images for this repo to find previous version
	images, err := c.cli.ImageList(ctx, imagetypes.ListOptions{
		Filters: filters.NewArgs(filters.Arg("reference", imgName)),
	})
	if err != nil {
		return "", fmt.Errorf("failed to list images: %w", err)
	}

	var previousTag string
	for _, imgEntry := range images {
		for _, tag := range imgEntry.RepoTags {
			_, t := parseImageTag(tag)
			if t != currentTag && t != "latest" && t != "" {
				previousTag = t
				break
			}
		}
	}

	if previousTag == "" {
		return "", fmt.Errorf("no previous version found for %s", name)
	}

	if err := c.PullAndUpdate(ctx, name, previousTag); err != nil {
		return "", err
	}

	return previousTag, nil
}

// getLatestTag queries Docker Hub API for the latest tag
func (c *Client) getLatestTag(image string) (string, error) {
	// image format: nrineau/essensys-backend
	parts := strings.SplitN(image, "/", 2)
	if len(parts) != 2 {
		return "", fmt.Errorf("invalid image format: %s", image)
	}

	url := fmt.Sprintf("https://hub.docker.com/v2/repositories/%s/%s/tags?page_size=10&ordering=last_updated", parts[0], parts[1])

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return "", fmt.Errorf("Docker Hub API returned %d", resp.StatusCode)
	}

	var result struct {
		Results []struct {
			Name string `json:"name"`
		} `json:"results"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}

	// Find latest non-"latest" tag (prefer version tags)
	for _, r := range result.Results {
		if r.Name != "latest" && strings.HasPrefix(r.Name, "V.") {
			return r.Name, nil
		}
	}

	if len(result.Results) > 0 {
		return result.Results[0].Name, nil
	}

	return "", nil
}

// Helper functions

func parseImageTag(imageStr string) (string, string) {
	// Remove sha256 digest if present
	if idx := strings.Index(imageStr, "@"); idx != -1 {
		imageStr = imageStr[:idx]
	}
	parts := strings.SplitN(imageStr, ":", 2)
	if len(parts) == 2 {
		return parts[0], parts[1]
	}
	return parts[0], "latest"
}

func normalizeState(state string) string {
	switch state {
	case "running":
		return "running"
	case "exited", "dead":
		return "stopped"
	case "restarting":
		return "restarting"
	case "created":
		return "created"
	default:
		return "unknown"
	}
}

func formatDuration(d time.Duration) string {
	if d < time.Minute {
		return fmt.Sprintf("%ds", int(d.Seconds()))
	}
	if d < time.Hour {
		return fmt.Sprintf("%dm", int(d.Minutes()))
	}
	if d < 24*time.Hour {
		return fmt.Sprintf("%dh %dm", int(d.Hours()), int(d.Minutes())%60)
	}
	days := int(d.Hours()) / 24
	hours := int(d.Hours()) % 24
	return fmt.Sprintf("%dd %dh", days, hours)
}

func stripDockerLogHeaders(s string) string {
	lines := strings.Split(s, "\n")
	clean := make([]string, 0, len(lines))
	for _, line := range lines {
		if len(line) > 8 {
			// Docker log lines have 8-byte header
			clean = append(clean, line[8:])
		} else if len(line) > 0 {
			clean = append(clean, line)
		}
	}
	return strings.Join(clean, "\n")
}

func (c *Client) Close() error {
	return c.cli.Close()
}
