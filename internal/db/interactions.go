package db

import (
	"time"

	"wemadeit/internal/models"
)

func (s *Store) SaveInteraction(i models.Interaction) error {
	occurredAtUnix := int64(0)
	if !i.OccurredAt.IsZero() {
		occurredAtUnix = i.OccurredAt.Unix()
	}
	followUpUnix := int64(0)
	if i.FollowUpDate != nil {
		followUpUnix = i.FollowUpDate.Unix()
	}
	followUpCompleted := 0
	if i.FollowUpCompleted {
		followUpCompleted = 1
	}

	_, err := s.DB.Exec(
		`INSERT OR REPLACE INTO interactions
		(id, user_id, organization_id, contact_id, deal_id, interaction_type, subject, body, occurred_at, duration_minutes, transcript, cleaned_transcript, follow_up_completed, follow_up_date, follow_up_notes, transcription_language, transcription_status, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
		i.ID,
		i.UserID,
		i.OrganizationID,
		i.ContactID,
		i.DealID,
		string(i.InteractionType),
		i.Subject,
		i.Body,
		occurredAtUnix,
		i.DurationMinutes,
		i.Transcript,
		i.CleanedTranscript,
		followUpCompleted,
		followUpUnix,
		i.FollowUpNotes,
		i.TranscriptionLanguage,
		i.TranscriptionStatus,
		i.CreatedAt.Unix(),
		i.UpdatedAt.Unix(),
	)
	return err
}

func (s *Store) LoadInteractions() ([]models.Interaction, error) {
	rows, err := s.DB.Query(`SELECT id, user_id, organization_id, contact_id, deal_id, interaction_type, subject, body, occurred_at, duration_minutes, transcript, cleaned_transcript, follow_up_completed, follow_up_date, follow_up_notes, transcription_language, transcription_status, created_at, updated_at FROM interactions ORDER BY occurred_at DESC, created_at DESC;`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]models.Interaction, 0)
	for rows.Next() {
		var i models.Interaction
		var occurredAtUnix int64
		var followUpCompleted int
		var followUpUnix int64
		var interactionType string
		var createdUnix, updatedUnix int64
		if err := rows.Scan(
			&i.ID,
			&i.UserID,
			&i.OrganizationID,
			&i.ContactID,
			&i.DealID,
			&interactionType,
			&i.Subject,
			&i.Body,
			&occurredAtUnix,
			&i.DurationMinutes,
			&i.Transcript,
			&i.CleanedTranscript,
			&followUpCompleted,
			&followUpUnix,
			&i.FollowUpNotes,
			&i.TranscriptionLanguage,
			&i.TranscriptionStatus,
			&createdUnix,
			&updatedUnix,
		); err != nil {
			return nil, err
		}
		i.InteractionType = models.InteractionType(interactionType)
		if occurredAtUnix > 0 {
			i.OccurredAt = time.Unix(occurredAtUnix, 0)
		}
		i.FollowUpCompleted = followUpCompleted != 0
		if followUpUnix > 0 {
			t := time.Unix(followUpUnix, 0)
			i.FollowUpDate = &t
		}
		i.CreatedAt = time.Unix(createdUnix, 0)
		i.UpdatedAt = time.Unix(updatedUnix, 0)
		out = append(out, i)
	}
	return out, rows.Err()
}

func (s *Store) DeleteInteraction(interactionID string) error {
	_, err := s.DB.Exec(`DELETE FROM interactions WHERE id = ?;`, interactionID)
	return err
}
