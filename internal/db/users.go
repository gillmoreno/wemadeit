package db

import (
	"database/sql"
	"strings"
	"time"

	"wemadeit/internal/models"
)

func (s *Store) SaveUser(u models.User) error {
	_, err := s.DB.Exec(
		`INSERT OR REPLACE INTO users
		(id, email_address, name, role, password_hash, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?);`,
		u.ID,
		strings.ToLower(strings.TrimSpace(u.EmailAddress)),
		u.Name,
		string(u.Role),
		u.PasswordHash,
		u.CreatedAt.Unix(),
		u.UpdatedAt.Unix(),
	)
	return err
}

func (s *Store) LoadUsers() ([]models.User, error) {
	rows, err := s.DB.Query(`SELECT id, email_address, name, role, password_hash, created_at, updated_at FROM users ORDER BY created_at DESC;`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	users := make([]models.User, 0)
	for rows.Next() {
		var u models.User
		var role string
		var createdUnix, updatedUnix int64
		if err := rows.Scan(&u.ID, &u.EmailAddress, &u.Name, &role, &u.PasswordHash, &createdUnix, &updatedUnix); err != nil {
			return nil, err
		}
		u.Role = models.UserRole(role)
		u.CreatedAt = time.Unix(createdUnix, 0)
		u.UpdatedAt = time.Unix(updatedUnix, 0)
		users = append(users, u)
	}
	return users, rows.Err()
}

func (s *Store) FindUserByEmail(email string) (models.User, bool, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	row := s.DB.QueryRow(`SELECT id, email_address, name, role, password_hash, created_at, updated_at FROM users WHERE email_address = ? LIMIT 1;`, email)
	var u models.User
	var role string
	var createdUnix, updatedUnix int64
	if err := row.Scan(&u.ID, &u.EmailAddress, &u.Name, &role, &u.PasswordHash, &createdUnix, &updatedUnix); err != nil {
		if err == sql.ErrNoRows {
			return models.User{}, false, nil
		}
		return models.User{}, false, err
	}
	u.Role = models.UserRole(role)
	u.CreatedAt = time.Unix(createdUnix, 0)
	u.UpdatedAt = time.Unix(updatedUnix, 0)
	return u, true, nil
}

func (s *Store) FindUserByID(id string) (models.User, bool, error) {
	row := s.DB.QueryRow(`SELECT id, email_address, name, role, password_hash, created_at, updated_at FROM users WHERE id = ? LIMIT 1;`, id)
	var u models.User
	var role string
	var createdUnix, updatedUnix int64
	if err := row.Scan(&u.ID, &u.EmailAddress, &u.Name, &role, &u.PasswordHash, &createdUnix, &updatedUnix); err != nil {
		if err == sql.ErrNoRows {
			return models.User{}, false, nil
		}
		return models.User{}, false, err
	}
	u.Role = models.UserRole(role)
	u.CreatedAt = time.Unix(createdUnix, 0)
	u.UpdatedAt = time.Unix(updatedUnix, 0)
	return u, true, nil
}

func (s *Store) SaveSession(token string, userID string, createdAt, expiresAt time.Time, userAgent string, ipAddress string) error {
	_, err := s.DB.Exec(
		`INSERT OR REPLACE INTO sessions
		(token, user_id, created_at, expires_at, user_agent, ip_address)
		VALUES (?, ?, ?, ?, ?, ?);`,
		token,
		userID,
		createdAt.Unix(),
		expiresAt.Unix(),
		userAgent,
		ipAddress,
	)
	return err
}

func (s *Store) LoadSession(token string) (models.Session, bool, error) {
	row := s.DB.QueryRow(`SELECT token, user_id, created_at, expires_at FROM sessions WHERE token = ? LIMIT 1;`, token)
	var sess models.Session
	var createdUnix, expiresUnix int64
	if err := row.Scan(&sess.Token, &sess.UserID, &createdUnix, &expiresUnix); err != nil {
		if err == sql.ErrNoRows {
			return models.Session{}, false, nil
		}
		return models.Session{}, false, err
	}
	sess.CreatedAt = time.Unix(createdUnix, 0)
	sess.ExpiresAt = time.Unix(expiresUnix, 0)
	return sess, true, nil
}

func (s *Store) DeleteSession(token string) error {
	_, err := s.DB.Exec(`DELETE FROM sessions WHERE token = ?;`, token)
	return err
}

func (s *Store) DeleteUser(userID string) (err error) {
	tx, err := s.DB.Begin()
	if err != nil {
		return err
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	// Keep tasks usable even if a user is removed.
	if _, err = tx.Exec(`UPDATE tasks SET owner_user_id = '' WHERE owner_user_id = ?;`, userID); err != nil {
		return err
	}
	if _, err = tx.Exec(`DELETE FROM sessions WHERE user_id = ?;`, userID); err != nil {
		return err
	}
	if _, err = tx.Exec(`DELETE FROM users WHERE id = ?;`, userID); err != nil {
		return err
	}
	return tx.Commit()
}
