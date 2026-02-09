package main

import (
	"flag"
	"fmt"
	"net/http"
	"os"
	"path/filepath"

	"wemadeit/internal/config"
	"wemadeit/internal/db"
	"wemadeit/internal/server"
)

func main() {
	addr := flag.String("addr", ":8080", "http listen address")
	dataDir := flag.String("data", defaultDataDir(), "data directory")
	configPath := flag.String("config", defaultConfigPath(), "config file")
	seed := flag.Bool("seed", true, "seed sample data on first run")
	flag.Parse()

	cfg, err := config.Load(*configPath)
	if err != nil {
		fmt.Println("Config error:", err)
		os.Exit(1)
	}

	store, err := db.Open(*dataDir)
	if err != nil {
		fmt.Println("DB error:", err)
		os.Exit(1)
	}
	defer store.Close()

	if *seed {
		if err := store.SeedIfNeeded(); err != nil {
			fmt.Println("Seed error:", err)
			os.Exit(1)
		}
	}

	srv := server.New(store, cfg, *configPath)
	fmt.Println("WeMadeIt API listening on", *addr)
	if err := http.ListenAndServe(*addr, srv.Handler()); err != nil {
		fmt.Println("Server error:", err)
		os.Exit(1)
	}
}

func defaultDataDir() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return "./data"
	}
	return filepath.Join(home, ".wemadeit")
}

func defaultConfigPath() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return "./wemadeit.json"
	}
	return filepath.Join(home, ".wemadeit", "config.json")
}
