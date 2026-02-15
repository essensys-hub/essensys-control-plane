package store

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

type Store struct {
	db *sql.DB
}

type AuditEntry struct {
	ID        int64     `json:"id"`
	Timestamp time.Time `json:"timestamp"`
	Action    string    `json:"action"`
	Key       string    `json:"key"`
	OldValue  string    `json:"old_value,omitempty"`
	NewValue  string    `json:"new_value,omitempty"`
	User      string    `json:"user,omitempty"`
}

type UpdateHistoryEntry struct {
	ID        int64     `json:"id"`
	Timestamp time.Time `json:"timestamp"`
	Service   string    `json:"service"`
	FromTag   string    `json:"from_tag"`
	ToTag     string    `json:"to_tag"`
	Status    string    `json:"status"` // "success", "failed", "rollback"
	Details   string    `json:"details,omitempty"`
}

func New(dbPath string) (*Store, error) {
	db, err := sql.Open("sqlite3", dbPath+"?_journal_mode=WAL")
	if err != nil {
		return nil, fmt.Errorf("failed to open SQLite: %w", err)
	}

	s := &Store{db: db}
	if err := s.migrate(); err != nil {
		return nil, fmt.Errorf("failed to migrate SQLite: %w", err)
	}

	log.Printf("[STORE] SQLite initialized at %s", dbPath)
	return s, nil
}

func (s *Store) migrate() error {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS audit_log (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
			action TEXT NOT NULL,
			key TEXT NOT NULL,
			old_value TEXT,
			new_value TEXT,
			user TEXT DEFAULT 'system'
		)`,
		`CREATE TABLE IF NOT EXISTS update_history (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
			service TEXT NOT NULL,
			from_tag TEXT,
			to_tag TEXT,
			status TEXT NOT NULL DEFAULT 'pending',
			details TEXT
		)`,
		`CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp)`,
		`CREATE INDEX IF NOT EXISTS idx_audit_key ON audit_log(key)`,
		`CREATE INDEX IF NOT EXISTS idx_update_service ON update_history(service)`,
		`CREATE INDEX IF NOT EXISTS idx_update_timestamp ON update_history(timestamp)`,
	}

	for _, q := range queries {
		if _, err := s.db.Exec(q); err != nil {
			return fmt.Errorf("migration failed: %w", err)
		}
	}
	return nil
}

// LogAudit records a Redis modification in the audit trail
func (s *Store) LogAudit(action, key, oldValue, newValue, user string) error {
	_, err := s.db.Exec(
		`INSERT INTO audit_log (action, key, old_value, new_value, user) VALUES (?, ?, ?, ?, ?)`,
		action, key, oldValue, newValue, user,
	)
	return err
}

// GetAuditLog retrieves audit entries with optional filters
func (s *Store) GetAuditLog(limit int, key string) ([]AuditEntry, error) {
	query := `SELECT id, timestamp, action, key, old_value, new_value, user FROM audit_log`
	args := []interface{}{}

	if key != "" {
		query += ` WHERE key LIKE ?`
		args = append(args, "%"+key+"%")
	}
	query += ` ORDER BY timestamp DESC LIMIT ?`
	args = append(args, limit)

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []AuditEntry
	for rows.Next() {
		var e AuditEntry
		var ts string
		if err := rows.Scan(&e.ID, &ts, &e.Action, &e.Key, &e.OldValue, &e.NewValue, &e.User); err != nil {
			return nil, err
		}
		e.Timestamp, _ = time.Parse("2006-01-02 15:04:05", ts)
		entries = append(entries, e)
	}
	return entries, nil
}

// RecordUpdate records a service update in history
func (s *Store) RecordUpdate(service, fromTag, toTag, status, details string) (int64, error) {
	result, err := s.db.Exec(
		`INSERT INTO update_history (service, from_tag, to_tag, status, details) VALUES (?, ?, ?, ?, ?)`,
		service, fromTag, toTag, status, details,
	)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

// UpdateUpdateStatus updates the status of a recorded update
func (s *Store) UpdateUpdateStatus(id int64, status, details string) error {
	_, err := s.db.Exec(
		`UPDATE update_history SET status = ?, details = ? WHERE id = ?`,
		status, details, id,
	)
	return err
}

// GetUpdateHistory retrieves update history entries
func (s *Store) GetUpdateHistory(limit int, service string) ([]UpdateHistoryEntry, error) {
	query := `SELECT id, timestamp, service, from_tag, to_tag, status, details FROM update_history`
	args := []interface{}{}

	if service != "" {
		query += ` WHERE service = ?`
		args = append(args, service)
	}
	query += ` ORDER BY timestamp DESC LIMIT ?`
	args = append(args, limit)

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []UpdateHistoryEntry
	for rows.Next() {
		var e UpdateHistoryEntry
		var ts string
		if err := rows.Scan(&e.ID, &ts, &e.Service, &e.FromTag, &e.ToTag, &e.Status, &e.Details); err != nil {
			return nil, err
		}
		e.Timestamp, _ = time.Parse("2006-01-02 15:04:05", ts)
		entries = append(entries, e)
	}
	return entries, nil
}

// GetStats returns store statistics as JSON
func (s *Store) GetStats() (map[string]interface{}, error) {
	stats := map[string]interface{}{}

	var auditCount int
	s.db.QueryRow(`SELECT COUNT(*) FROM audit_log`).Scan(&auditCount)
	stats["audit_entries"] = auditCount

	var updateCount int
	s.db.QueryRow(`SELECT COUNT(*) FROM update_history`).Scan(&updateCount)
	stats["update_entries"] = updateCount

	return stats, nil
}

func (s *Store) Close() error {
	return s.db.Close()
}

// MarshalJSON helper
func toJSON(v interface{}) string {
	b, _ := json.Marshal(v)
	return string(b)
}
