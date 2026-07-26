package i18n

// MessageID names one thing the server can say to a PLAYER. Ids rather than
// literals at the call site, so a sentence exists in exactly one place and the
// tests can prove every locale has it.
//
// The set is deliberately small: it covers the errors a player actually reads
// on screen (RoundRunner and StatusMessage in apps/player render the API's
// message verbatim). Admin-only failures — a bad upload, an unknown status
// filter, an unauthorized token — stay as English literals at their call sites,
// because the admin app is not translated and inventing Thai for an operator
// error nobody will see is how a message table starts rotting.
type MessageID string

const (
	MsgNotFound        MessageID = "error.notFound"
	MsgGameNotFound    MessageID = "error.gameNotFound"
	MsgGameUnavailable MessageID = "error.gameUnavailable"
	MsgInvalidSession  MessageID = "error.invalidSession"
	MsgSessionExpired  MessageID = "error.sessionExpired"
	MsgSessionConsumed MessageID = "error.sessionConsumed"
	MsgScoreRejected   MessageID = "error.scoreRejected"
	MsgClaimNotFound   MessageID = "error.claimNotFound"
	MsgConflict        MessageID = "error.conflict"
	MsgInternalError   MessageID = "error.internal"
	MsgInvalidBody     MessageID = "error.invalidBody"
	MsgTokenRequired   MessageID = "error.tokenRequired"
)

// messages is the catalog, keyed locale → id → text.
//
// English is the reference column and every id must appear in it; a locale that
// is missing an id falls back to English rather than to nothing (see Message).
// The test suite asserts both halves of that: English is complete, and every
// other locale covers every English id.
var messages = map[Locale]map[MessageID]string{
	English: {
		MsgNotFound:        "not found",
		MsgGameNotFound:    "game not found",
		MsgGameUnavailable: "game unavailable",
		MsgInvalidSession:  "invalid session",
		MsgSessionExpired:  "session expired",
		MsgSessionConsumed: "session already used",
		MsgScoreRejected:   "that score could not be verified",
		MsgClaimNotFound:   "claim not found",
		MsgConflict:        "conflict",
		MsgInternalError:   "internal error",
		MsgInvalidBody:     "invalid request body",
		MsgTokenRequired:   "token is required",
	},
	Thai: {
		MsgNotFound:        "ไม่พบข้อมูล",
		MsgGameNotFound:    "ไม่พบเกมนี้",
		MsgGameUnavailable: "เกมนี้ยังไม่เปิดให้เล่น",
		MsgInvalidSession:  "รอบการเล่นไม่ถูกต้อง",
		MsgSessionExpired:  "รอบการเล่นหมดเวลาแล้ว",
		MsgSessionConsumed: "รอบการเล่นนี้ถูกใช้ไปแล้ว",
		MsgScoreRejected:   "ตรวจสอบคะแนนนี้ไม่ผ่าน",
		MsgClaimNotFound:   "ไม่พบรหัสรับรางวัลนี้",
		MsgConflict:        "ข้อมูลขัดแย้งกัน",
		MsgInternalError:   "เกิดข้อผิดพลาดภายในระบบ",
		MsgInvalidBody:     "ข้อมูลที่ส่งมาไม่ถูกต้อง",
		MsgTokenRequired:   "ต้องระบุโทเคนของรอบการเล่น",
	},
}

// Message returns the text for an id in a locale, falling back to English for a
// locale that has no entry, and to the id itself for an id nobody wrote at all.
//
// Falling back to the id rather than to "" is on purpose: an untranslated
// string should be visibly wrong in a screenshot, not invisibly missing.
func Message(id MessageID, loc Locale) string {
	if table, ok := messages[loc]; ok {
		if text, ok := table[id]; ok {
			return text
		}
	}
	if text, ok := messages[English][id]; ok {
		return text
	}
	return string(id)
}
