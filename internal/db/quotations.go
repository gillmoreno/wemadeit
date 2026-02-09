package db

import (
	"database/sql"
	"fmt"
	"strconv"
	"strings"
	"time"

	"wemadeit/internal/models"
)

func (s *Store) SaveQuotation(q models.Quotation) error {
	validUntilUnix := int64(0)
	if q.ValidUntil != nil {
		validUntilUnix = q.ValidUntil.Unix()
	}
	_, err := s.DB.Exec(
		`INSERT OR REPLACE INTO quotations
		(id, deal_id, created_by_user_id, number, title, introduction, terms_and_conditions, currency, status, subtotal, tax_rate, tax_amount, discount_amount, total, valid_until, version, public_token, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
		q.ID,
		q.DealID,
		q.CreatedByUserID,
		q.Number,
		q.Title,
		q.Introduction,
		q.Terms,
		q.Currency,
		string(q.Status),
		q.Subtotal,
		q.TaxRate,
		q.TaxAmount,
		q.DiscountAmount,
		q.Total,
		validUntilUnix,
		q.Version,
		q.PublicToken,
		q.CreatedAt.Unix(),
		q.UpdatedAt.Unix(),
	)
	return err
}

func (s *Store) LoadQuotations() ([]models.Quotation, error) {
	rows, err := s.DB.Query(`SELECT id, deal_id, created_by_user_id, number, title, introduction, terms_and_conditions, currency, status, subtotal, tax_rate, tax_amount, discount_amount, total, valid_until, version, public_token, created_at, updated_at FROM quotations ORDER BY created_at DESC;`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]models.Quotation, 0)
	for rows.Next() {
		var q models.Quotation
		var status string
		var validUntilUnix int64
		var createdUnix, updatedUnix int64
		if err := rows.Scan(
			&q.ID,
			&q.DealID,
			&q.CreatedByUserID,
			&q.Number,
			&q.Title,
			&q.Introduction,
			&q.Terms,
			&q.Currency,
			&status,
			&q.Subtotal,
			&q.TaxRate,
			&q.TaxAmount,
			&q.DiscountAmount,
			&q.Total,
			&validUntilUnix,
			&q.Version,
			&q.PublicToken,
			&createdUnix,
			&updatedUnix,
		); err != nil {
			return nil, err
		}
		q.Status = models.QuotationStatus(status)
		if validUntilUnix > 0 {
			t := time.Unix(validUntilUnix, 0)
			q.ValidUntil = &t
		}
		q.CreatedAt = time.Unix(createdUnix, 0)
		q.UpdatedAt = time.Unix(updatedUnix, 0)
		out = append(out, q)
	}
	return out, rows.Err()
}

func (s *Store) SaveQuotationItem(it models.QuotationItem) error {
	lineTotal := it.LineTotal
	if lineTotal == 0 && it.Quantity != 0 {
		lineTotal = it.Quantity * it.UnitPrice
	}
	_, err := s.DB.Exec(
		`INSERT OR REPLACE INTO quotation_items
		(id, quotation_id, name, description, quantity, unit_price, unit_type, line_total, position, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
		it.ID,
		it.QuotationID,
		it.Name,
		it.Description,
		it.Quantity,
		it.UnitPrice,
		it.UnitType,
		lineTotal,
		it.Position,
		it.CreatedAt.Unix(),
		it.UpdatedAt.Unix(),
	)
	return err
}

func (s *Store) LoadQuotationItems() ([]models.QuotationItem, error) {
	rows, err := s.DB.Query(`SELECT id, quotation_id, name, description, quantity, unit_price, unit_type, line_total, position, created_at, updated_at FROM quotation_items ORDER BY quotation_id ASC, position ASC;`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]models.QuotationItem, 0)
	for rows.Next() {
		var it models.QuotationItem
		var createdUnix, updatedUnix int64
		if err := rows.Scan(
			&it.ID,
			&it.QuotationID,
			&it.Name,
			&it.Description,
			&it.Quantity,
			&it.UnitPrice,
			&it.UnitType,
			&it.LineTotal,
			&it.Position,
			&createdUnix,
			&updatedUnix,
		); err != nil {
			return nil, err
		}
		it.CreatedAt = time.Unix(createdUnix, 0)
		it.UpdatedAt = time.Unix(updatedUnix, 0)
		out = append(out, it)
	}
	return out, rows.Err()
}

func (s *Store) LoadQuotationItemsByQuotation(quotationID string) ([]models.QuotationItem, error) {
	rows, err := s.DB.Query(`SELECT id, quotation_id, name, description, quantity, unit_price, unit_type, line_total, position, created_at, updated_at FROM quotation_items WHERE quotation_id = ? ORDER BY position ASC;`, quotationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]models.QuotationItem, 0)
	for rows.Next() {
		var it models.QuotationItem
		var createdUnix, updatedUnix int64
		if err := rows.Scan(
			&it.ID,
			&it.QuotationID,
			&it.Name,
			&it.Description,
			&it.Quantity,
			&it.UnitPrice,
			&it.UnitType,
			&it.LineTotal,
			&it.Position,
			&createdUnix,
			&updatedUnix,
		); err != nil {
			return nil, err
		}
		it.CreatedAt = time.Unix(createdUnix, 0)
		it.UpdatedAt = time.Unix(updatedUnix, 0)
		out = append(out, it)
	}
	return out, rows.Err()
}

func (s *Store) RecalcQuotationTotals(quotationID string) error {
	items, err := s.LoadQuotationItemsByQuotation(quotationID)
	if err != nil {
		return err
	}

	row := s.DB.QueryRow(`SELECT tax_rate, discount_amount FROM quotations WHERE id = ? LIMIT 1;`, quotationID)
	var taxRate float64
	var discount float64
	if err := row.Scan(&taxRate, &discount); err != nil {
		if err == sql.ErrNoRows {
			return nil
		}
		return err
	}

	subtotal := 0.0
	for _, it := range items {
		subtotal += it.LineTotal
	}
	taxAmount := 0.0
	if taxRate > 0 {
		taxAmount = subtotal * (taxRate / 100.0)
	}
	total := subtotal + taxAmount - discount

	_, err = s.DB.Exec(
		`UPDATE quotations SET subtotal = ?, tax_amount = ?, total = ?, updated_at = ? WHERE id = ?;`,
		subtotal,
		taxAmount,
		total,
		time.Now().Unix(),
		quotationID,
	)
	return err
}

func (s *Store) NextQuotationNumber(year int) (string, error) {
	prefix := fmt.Sprintf("QUO-%d-", year)
	pattern := prefix + "%"

	row := s.DB.QueryRow(`SELECT number FROM quotations WHERE number LIKE ? ORDER BY number DESC LIMIT 1;`, pattern)
	var last string
	if err := row.Scan(&last); err != nil {
		if err == sql.ErrNoRows {
			return fmt.Sprintf("%s%03d", prefix, 1), nil
		}
		return "", err
	}

	parts := strings.Split(last, "-")
	if len(parts) < 3 {
		return fmt.Sprintf("%s%03d", prefix, 1), nil
	}
	n, err := strconv.Atoi(parts[len(parts)-1])
	if err != nil {
		return fmt.Sprintf("%s%03d", prefix, 1), nil
	}
	return fmt.Sprintf("%s%03d", prefix, n+1), nil
}
