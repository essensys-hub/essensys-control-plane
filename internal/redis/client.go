package redis

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strconv"
	"strings"
	"time"

	"github.com/go-redis/redis/v8"
)

type Client struct {
	rdb *redis.Client
	ctx context.Context
}

// Exchange table entry
type ExchangeEntry struct {
	Index int    `json:"index"`
	Value string `json:"value"`
}

// Client info
type ClientInfo struct {
	ClientID      string `json:"client_id"`
	Connected     bool   `json:"connected"`
	IP            string `json:"ip,omitempty"`
	Auth          string `json:"auth,omitempty"`
	Version       string `json:"version,omitempty"`
	LastUpdated   string `json:"last_updated,omitempty"`
	ExchangeCount int    `json:"exchange_count"`
}

// Action in the queue
type Action struct {
	GUID   string                 `json:"GUID"`
	Type   string                 `json:"type,omitempty"`
	Params map[string]interface{} `json:"params,omitempty"`
	Raw    string                 `json:"raw,omitempty"`
}

// Redis server info
type RedisInfo struct {
	Version         string `json:"version"`
	Uptime          int64  `json:"uptime_seconds"`
	ConnectedClients int   `json:"connected_clients"`
	UsedMemory      string `json:"used_memory_human"`
	UsedMemoryBytes int64  `json:"used_memory"`
	MaxMemory       string `json:"max_memory_human"`
	TotalKeys       int64  `json:"total_keys"`
	OpsPerSec       int64  `json:"ops_per_sec"`
	LatencyMs       float64 `json:"latency_ms"`
}

// Key info for the key browser
type KeyInfo struct {
	Key  string `json:"key"`
	Type string `json:"type"`
	Size int64  `json:"size"`
	TTL  int64  `json:"ttl"`
}

func New(addr, password string, db int) (*Client, error) {
	rdb := redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: password,
		DB:       db,
	})

	ctx := context.Background()
	if err := rdb.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to Redis at %s: %w", addr, err)
	}

	log.Printf("[REDIS] Connected to Redis at %s (db=%d)", addr, db)
	return &Client{rdb: rdb, ctx: ctx}, nil
}

// --- Exchange Table Operations ---

func (c *Client) GetExchangeTable(clientID string) ([]ExchangeEntry, error) {
	key := fmt.Sprintf("essensys:client:%s:exchange", clientID)
	vals, err := c.rdb.HGetAll(c.ctx, key).Result()
	if err != nil {
		return nil, err
	}

	entries := make([]ExchangeEntry, 0, len(vals))
	for k, v := range vals {
		idx, _ := strconv.Atoi(k)
		entries = append(entries, ExchangeEntry{Index: idx, Value: v})
	}
	return entries, nil
}

func (c *Client) GetExchangeValue(clientID string, index int) (string, bool, error) {
	key := fmt.Sprintf("essensys:client:%s:exchange", clientID)
	val, err := c.rdb.HGet(c.ctx, key, strconv.Itoa(index)).Result()
	if err == redis.Nil {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	return val, true, nil
}

func (c *Client) SetExchangeValue(clientID string, index int, value string) (string, error) {
	key := fmt.Sprintf("essensys:client:%s:exchange", clientID)
	field := strconv.Itoa(index)

	// Get old value for audit
	oldVal, _ := c.rdb.HGet(c.ctx, key, field).Result()

	err := c.rdb.HSet(c.ctx, key, field, value).Err()
	if err != nil {
		return "", err
	}
	return oldVal, nil
}

func (c *Client) SearchExchange(clientID, query string) ([]ExchangeEntry, error) {
	entries, err := c.GetExchangeTable(clientID)
	if err != nil {
		return nil, err
	}

	q := strings.ToLower(query)
	filtered := make([]ExchangeEntry, 0)
	for _, e := range entries {
		if strings.Contains(strings.ToLower(e.Value), q) ||
			strings.Contains(strconv.Itoa(e.Index), q) {
			filtered = append(filtered, e)
		}
	}
	return filtered, nil
}

// --- Client Operations ---

func (c *Client) ListClients() ([]ClientInfo, error) {
	// Scan for all client keys
	pattern := "essensys:client:*:connected"
	keys, err := c.scanKeys(pattern)
	if err != nil {
		return nil, err
	}

	clients := make([]ClientInfo, 0)
	for _, key := range keys {
		// Extract clientID from key
		parts := strings.Split(key, ":")
		if len(parts) < 3 {
			continue
		}
		clientID := parts[2]

		info := ClientInfo{ClientID: clientID}

		// Get connection status
		val, _ := c.rdb.Get(c.ctx, key).Result()
		info.Connected = val == "true"

		// Get auth info
		authKey := fmt.Sprintf("essensys:client:%s:authinfo", clientID)
		authVals, err := c.rdb.HMGet(c.ctx, authKey, "ip", "auth", "version", "updated").Result()
		if err == nil && len(authVals) >= 4 {
			if v, ok := authVals[0].(string); ok {
				info.IP = v
			}
			if v, ok := authVals[1].(string); ok {
				info.Auth = v
			}
			if v, ok := authVals[2].(string); ok {
				info.Version = v
			}
			if v, ok := authVals[3].(string); ok {
				info.LastUpdated = v
			}
		}

		// Get exchange entry count
		exchKey := fmt.Sprintf("essensys:client:%s:exchange", clientID)
		count, _ := c.rdb.HLen(c.ctx, exchKey).Result()
		info.ExchangeCount = int(count)

		clients = append(clients, info)
	}

	return clients, nil
}

func (c *Client) GetClientInfo(clientID string) (*ClientInfo, error) {
	info := &ClientInfo{ClientID: clientID}

	// Connection status
	connKey := fmt.Sprintf("essensys:client:%s:connected", clientID)
	val, _ := c.rdb.Get(c.ctx, connKey).Result()
	info.Connected = val == "true"

	// Auth info
	authKey := fmt.Sprintf("essensys:client:%s:authinfo", clientID)
	authVals, err := c.rdb.HMGet(c.ctx, authKey, "ip", "auth", "version", "updated").Result()
	if err == nil && len(authVals) >= 4 {
		if v, ok := authVals[0].(string); ok {
			info.IP = v
		}
		if v, ok := authVals[1].(string); ok {
			info.Auth = v
		}
		if v, ok := authVals[2].(string); ok {
			info.Version = v
		}
		if v, ok := authVals[3].(string); ok {
			info.LastUpdated = v
		}
	}

	// Exchange count
	exchKey := fmt.Sprintf("essensys:client:%s:exchange", clientID)
	count, _ := c.rdb.HLen(c.ctx, exchKey).Result()
	info.ExchangeCount = int(count)

	return info, nil
}

// --- Action Queue Operations ---

func (c *Client) GetActions() ([]Action, error) {
	key := "essensys:global:actions"
	vals, err := c.rdb.LRange(c.ctx, key, 0, -1).Result()
	if err != nil {
		return nil, err
	}

	actions := make([]Action, 0, len(vals))
	for _, v := range vals {
		var act Action
		if err := json.Unmarshal([]byte(v), &act); err != nil {
			actions = append(actions, Action{Raw: v})
		} else {
			actions = append(actions, act)
		}
	}
	return actions, nil
}

func (c *Client) PushAction(action Action) error {
	data, err := json.Marshal(action)
	if err != nil {
		return err
	}
	return c.rdb.RPush(c.ctx, "essensys:global:actions", string(data)).Err()
}

func (c *Client) RemoveAction(guid string) error {
	key := "essensys:global:actions"
	vals, err := c.rdb.LRange(c.ctx, key, 0, -1).Result()
	if err != nil {
		return err
	}

	for _, v := range vals {
		var act Action
		if err := json.Unmarshal([]byte(v), &act); err == nil {
			if act.GUID == guid {
				c.rdb.LRem(c.ctx, key, 1, v)
				return nil
			}
		}
	}
	return fmt.Errorf("action %s not found", guid)
}

func (c *Client) PurgeActions() (int64, error) {
	key := "essensys:global:actions"
	length, _ := c.rdb.LLen(c.ctx, key).Result()
	err := c.rdb.Del(c.ctx, key).Err()
	return length, err
}

// --- Redis Info & Monitoring ---

func (c *Client) GetRedisInfo() (*RedisInfo, error) {
	// Ping latency
	start := time.Now()
	c.rdb.Ping(c.ctx)
	latency := time.Since(start).Seconds() * 1000

	infoStr, err := c.rdb.Info(c.ctx).Result()
	if err != nil {
		return nil, err
	}

	info := &RedisInfo{LatencyMs: latency}
	lines := strings.Split(infoStr, "\r\n")
	for _, line := range lines {
		parts := strings.SplitN(line, ":", 2)
		if len(parts) != 2 {
			continue
		}
		key, value := parts[0], parts[1]
		switch key {
		case "redis_version":
			info.Version = value
		case "uptime_in_seconds":
			info.Uptime, _ = strconv.ParseInt(value, 10, 64)
		case "connected_clients":
			info.ConnectedClients, _ = strconv.Atoi(value)
		case "used_memory_human":
			info.UsedMemory = value
		case "used_memory":
			info.UsedMemoryBytes, _ = strconv.ParseInt(value, 10, 64)
		case "maxmemory_human":
			info.MaxMemory = value
		case "instantaneous_ops_per_sec":
			info.OpsPerSec, _ = strconv.ParseInt(value, 10, 64)
		}
	}

	// Count essensys keys
	keys, _ := c.scanKeys("essensys:*")
	info.TotalKeys = int64(len(keys))

	return info, nil
}

func (c *Client) ListKeys() ([]KeyInfo, error) {
	keys, err := c.scanKeys("essensys:*")
	if err != nil {
		return nil, err
	}

	keyInfos := make([]KeyInfo, 0, len(keys))
	pipe := c.rdb.Pipeline()

	// Batch type and size queries
	typeCmds := make([]*redis.StatusCmd, len(keys))
	for i, key := range keys {
		typeCmds[i] = pipe.Type(c.ctx, key)
	}
	pipe.Exec(c.ctx)

	for i, key := range keys {
		keyType := typeCmds[i].Val()
		var size int64

		switch keyType {
		case "hash":
			size, _ = c.rdb.HLen(c.ctx, key).Result()
		case "list":
			size, _ = c.rdb.LLen(c.ctx, key).Result()
		case "string":
			size, _ = c.rdb.StrLen(c.ctx, key).Result()
		case "set":
			size, _ = c.rdb.SCard(c.ctx, key).Result()
		}

		ttl, _ := c.rdb.TTL(c.ctx, key).Result()

		keyInfos = append(keyInfos, KeyInfo{
			Key:  key,
			Type: keyType,
			Size: size,
			TTL:  int64(ttl.Seconds()),
		})
	}

	return keyInfos, nil
}

// --- Backup/Restore ---

func (c *Client) BackupAll() (map[string]interface{}, error) {
	keys, err := c.scanKeys("essensys:*")
	if err != nil {
		return nil, err
	}

	backup := make(map[string]interface{})
	for _, key := range keys {
		keyType, _ := c.rdb.Type(c.ctx, key).Result()
		switch keyType {
		case "hash":
			vals, _ := c.rdb.HGetAll(c.ctx, key).Result()
			backup[key] = map[string]interface{}{"type": "hash", "data": vals}
		case "list":
			vals, _ := c.rdb.LRange(c.ctx, key, 0, -1).Result()
			backup[key] = map[string]interface{}{"type": "list", "data": vals}
		case "string":
			val, _ := c.rdb.Get(c.ctx, key).Result()
			backup[key] = map[string]interface{}{"type": "string", "data": val}
		case "set":
			vals, _ := c.rdb.SMembers(c.ctx, key).Result()
			backup[key] = map[string]interface{}{"type": "set", "data": vals}
		}
	}

	return backup, nil
}

func (c *Client) RestoreAll(data map[string]interface{}) error {
	for key, raw := range data {
		entry, ok := raw.(map[string]interface{})
		if !ok {
			continue
		}

		keyType, _ := entry["type"].(string)
		switch keyType {
		case "hash":
			if d, ok := entry["data"].(map[string]interface{}); ok {
				args := make([]interface{}, 0)
				for k, v := range d {
					args = append(args, k, v)
				}
				c.rdb.HSet(c.ctx, key, args...)
			}
		case "list":
			if d, ok := entry["data"].([]interface{}); ok {
				c.rdb.Del(c.ctx, key)
				for _, v := range d {
					c.rdb.RPush(c.ctx, key, v)
				}
			}
		case "string":
			if d, ok := entry["data"].(string); ok {
				c.rdb.Set(c.ctx, key, d, 0)
			}
		}
	}
	return nil
}

// Helper: scan keys matching a pattern
func (c *Client) scanKeys(pattern string) ([]string, error) {
	var allKeys []string
	var cursor uint64

	for {
		keys, nextCursor, err := c.rdb.Scan(c.ctx, cursor, pattern, 100).Result()
		if err != nil {
			return nil, err
		}
		allKeys = append(allKeys, keys...)
		cursor = nextCursor
		if cursor == 0 {
			break
		}
	}

	return allKeys, nil
}

func (c *Client) Close() error {
	return c.rdb.Close()
}
