package db

import (
	"time"

	"wemadeit/internal/models"
)

func (s *Store) SavePayment(p models.Payment) error {
	dueUnix := int64(0)
	if p.DueAt != nil {
		dueUnix = p.DueAt.Unix()
	}
	paidUnix := int64(0)
	if p.PaidAt != nil {
		paidUnix = p.PaidAt.Unix()
	}

	_, err := s.DB.Exec(
		`INSERT OR REPLACE INTO payments
		(id, deal_id, title, amount, currency, status, due_at, paid_at, method, notes, gil_amount, ric_amount, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
		p.ID,
		p.DealID,
		p.Title,
		p.Amount,
		p.Currency,
		string(p.Status),
		dueUnix,
		paidUnix,
		p.Method,
		p.Notes,
		p.GilAmount,
		p.RicAmount,
		p.CreatedAt.Unix(),
		p.UpdatedAt.Unix(),
	)
	return err
}

func (s *Store) LoadPayments() ([]models.Payment, error) {
	rows, err := s.DB.Query(`SELECT id, deal_id, title, amount, currency, status, due_at, paid_at, method, notes, gil_amount, ric_amount, created_at, updated_at FROM payments ORDER BY created_at DESC;`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]models.Payment, 0)
	for rows.Next() {
		var p models.Payment
		var status string
		var dueUnix, paidUnix, createdUnix, updatedUnix int64
		if err := rows.Scan(
			&p.ID,
			&p.DealID,
			&p.Title,
			&p.Amount,
			&p.Currency,
			&status,
			&dueUnix,
			&paidUnix,
			&p.Method,
			&p.Notes,
			&p.GilAmount,
			&p.RicAmount,
			&createdUnix,
			&updatedUnix,
		); err != nil {
			return nil, err
		}
		p.Status = models.PaymentStatus(status)
		if dueUnix > 0 {
			t := time.Unix(dueUnix, 0)
			p.DueAt = &t
		}
		if paidUnix > 0 {
			t := time.Unix(paidUnix, 0)
			p.PaidAt = &t
		}
		p.CreatedAt = time.Unix(createdUnix, 0)
		p.UpdatedAt = time.Unix(updatedUnix, 0)
		out = append(out, p)
	}
	return out, rows.Err()
}

func (s *Store) LoadPaymentsByDeal(dealID string) ([]models.Payment, error) {
	rows, err := s.DB.Query(`SELECT id, deal_id, title, amount, currency, status, due_at, paid_at, method, notes, gil_amount, ric_amount, created_at, updated_at FROM payments WHERE deal_id = ? ORDER BY created_at DESC;`, dealID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]models.Payment, 0)
	for rows.Next() {
		var p models.Payment
		var status string
		var dueUnix, paidUnix, createdUnix, updatedUnix int64
		if err := rows.Scan(
			&p.ID,
			&p.DealID,
			&p.Title,
			&p.Amount,
			&p.Currency,
			&status,
			&dueUnix,
			&paidUnix,
			&p.Method,
			&p.Notes,
			&p.GilAmount,
			&p.RicAmount,
			&createdUnix,
			&updatedUnix,
		); err != nil {
			return nil, err
		}
		p.Status = models.PaymentStatus(status)
		if dueUnix > 0 {
			t := time.Unix(dueUnix, 0)
			p.DueAt = &t
		}
		if paidUnix > 0 {
			t := time.Unix(paidUnix, 0)
			p.PaidAt = &t
		}
		p.CreatedAt = time.Unix(createdUnix, 0)
		p.UpdatedAt = time.Unix(updatedUnix, 0)
		out = append(out, p)
	}
	return out, rows.Err()
}

func (s *Store) DeletePayment(id string) error {
	_, err := s.DB.Exec(`DELETE FROM payments WHERE id = ?;`, id)
	return err
}

