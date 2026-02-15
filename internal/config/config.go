package config

import (
	"log"
	"os"
	"strconv"

	"gopkg.in/yaml.v3"
)

type Config struct {
	Server   ServerConfig   `yaml:"server"`
	Redis    RedisConfig    `yaml:"redis"`
	Docker   DockerConfig   `yaml:"docker"`
	SQLite   SQLiteConfig   `yaml:"sqlite"`
	Registry RegistryConfig `yaml:"registry"`
}

type ServerConfig struct {
	Port  int    `yaml:"port"`
	Token string `yaml:"token"`
}

type RedisConfig struct {
	Addr     string `yaml:"addr"`
	Password string `yaml:"password"`
	DB       int    `yaml:"db"`
}

type DockerConfig struct {
	SocketPath string `yaml:"socket_path"`
}

type SQLiteConfig struct {
	Path string `yaml:"path"`
}

type RegistryConfig struct {
	Org string `yaml:"org"`
}

func DefaultConfig() *Config {
	return &Config{
		Server: ServerConfig{
			Port:  9100,
			Token: "",
		},
		Redis: RedisConfig{
			Addr:     "localhost:6379",
			Password: "",
			DB:       0,
		},
		Docker: DockerConfig{
			SocketPath: "/var/run/docker.sock",
		},
		SQLite: SQLiteConfig{
			Path: "/data/controlplane.db",
		},
		Registry: RegistryConfig{
			Org: "nrineau",
		},
	}
}

func Load(path string) *Config {
	cfg := DefaultConfig()

	// Load from YAML file if exists
	if path != "" {
		data, err := os.ReadFile(path)
		if err == nil {
			if err := yaml.Unmarshal(data, cfg); err != nil {
				log.Printf("[CONFIG] Warning: failed to parse %s: %v", path, err)
			}
		}
	}

	// Override from environment variables
	cfg.loadFromEnv()

	return cfg
}

func (c *Config) loadFromEnv() {
	if v := os.Getenv("CP_PORT"); v != "" {
		if port, err := strconv.Atoi(v); err == nil {
			c.Server.Port = port
		}
	}
	if v := os.Getenv("CP_TOKEN"); v != "" {
		c.Server.Token = v
	}
	if v := os.Getenv("REDIS_ADDR"); v != "" {
		c.Redis.Addr = v
	}
	if v := os.Getenv("REDIS_PASSWORD"); v != "" {
		c.Redis.Password = v
	}
	if v := os.Getenv("REDIS_DB"); v != "" {
		if db, err := strconv.Atoi(v); err == nil {
			c.Redis.DB = db
		}
	}
	if v := os.Getenv("DOCKER_SOCKET"); v != "" {
		c.Docker.SocketPath = v
	}
	if v := os.Getenv("SQLITE_PATH"); v != "" {
		c.SQLite.Path = v
	}
	if v := os.Getenv("REGISTRY_ORG"); v != "" {
		c.Registry.Org = v
	}
}
