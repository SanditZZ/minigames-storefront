import type { Messages } from "./en";

// DATA layer: the player app in Thai.
//
// Typed as `Messages` rather than inferred, which is the whole safety story
// here: a key added to ./en and not to this file fails `npm run typecheck`, so
// the build breaks before a Thai storefront can show an English button.
//
// Two things about Thai that shaped the wording below, both worth knowing
// before adding a string:
//
//   1. Thai does not put spaces between words. `truncate` and `line-clamp` cut
//      mid-word rather than at a boundary, so a line that overruns turns into
//      nonsense instead of shortening. Every string that lands in a fixed slot
//      — the tier ladder, the score unit, the quit button, the prize badge — is
//      kept short here on purpose, not translated word for word.
//   2. A space around a placeholder is a real space in Thai, and usually the
//      wrong one. "คัดลอก{label}" is right; "คัดลอก {label}" reads as a gap.
//      Placeholders that follow a Thai word are therefore flush against it,
//      even where the English has a space.
export const th: Messages = {
  // --- App shell ---------------------------------------------------------
  "app.notFound.title": "ไม่พบหน้านี้",
  "app.notFound.detail": "ลิงก์นี้ไม่ได้พาไปที่ไหน",
  "app.notFound.action": "ไปเล่นเกม",
  "app.backendUnreachable": "เซิร์ฟเวอร์เปิดอยู่หรือเปล่า?",

  // --- Language switcher -------------------------------------------------
  "language.label": "ภาษา",
  "language.switchTo": "เปลี่ยนเป็น{language}",

  // --- Store identity, when the operator has set none --------------------
  "brand.name": "ร้านสนุก",
  "brand.tagline": "ขอบคุณที่แวะมาอุดหนุน — มาลองเสี่ยงโชคกัน!",

  // --- Landing screen ----------------------------------------------------
  "home.title": "เล่นเลย ลุ้นรางวัล 🎁",
  "home.loading": "กำลังโหลดเกม…",
  "home.unreachable.title": "เชื่อมต่อกับเกมไม่ได้",
  "home.unreachable.action": "ลองอีกครั้ง",
  "home.refresh": "รีเฟรชข้อมูลร้าน",
  "home.refreshing": "กำลังรีเฟรช…",
  "home.nameLabel": "ชื่อของคุณ (ไม่ใส่ก็ได้)",
  "home.play": "เล่น",
  "home.soon": "เร็ว ๆ นี้",
  "home.prizes.title": "ของรางวัลวันนี้",
  "home.prizes.soldOut": "หมดแล้ว",

  // Deliberately untranslated — see the note on this key in ./en. It is the
  // name written to the scores table, and a leaderboard is read by everyone.
  "player.guest": "Guest",

  // --- Play screen and the round runner ----------------------------------
  "play.loading": "กำลังเตรียมพร้อม…",
  "play.notFound.title": "ไม่พบเกมนี้",
  "play.notFound.detail": "ตอนนี้ยังเล่นเกมนี้ไม่ได้",
  "play.notFound.action": "ดูเกมทั้งหมด",
  "play.unsupported.title": "ยังเล่นไม่ได้",
  "play.unsupported.detail": "แอปเวอร์ชันนี้ยังไม่มีเกมนี้",
  "play.failed.title": "เกิดข้อผิดพลาด",
  "play.back": "ย้อนกลับ",
  "play.startFailed": "เริ่มเกมไม่สำเร็จ",
  "play.submitFailed": "ส่งคะแนนไม่สำเร็จ",
  "play.playingAs": "กำลังเล่นในชื่อ {name}",
  "play.quit": "ออก",
  "play.quitConfirm": "แน่ใจ?",
  "play.quitConfirmAria": "ยืนยันออกจากรอบนี้",
  "play.secondsLeft": "เหลือ {seconds} วิ",

  // --- Countdown ---------------------------------------------------------
  "countdown.go": "ไป!",
  "countdown.starting": "จะเริ่มในอีก {seconds} วินาที",

  // --- The beat between the round and the score --------------------------
  "complete.aria": "จบรอบแล้ว กำลังส่งคะแนนของคุณ",
  "complete.eyebrow": "จบรอบ",
  "complete.title": "จบเกมแล้ว!",
  "complete.scoring": "กำลังคิดคะแนน…",
  "complete.revealing": "กำลังเปิดคะแนน…",

  // --- Score reveal ------------------------------------------------------
  "reveal.aria": "กำลังเปิดคะแนนของคุณ",
  "reveal.measuring": "กำลังวัด…",
  "reveal.holdTight": "รอสักครู่…",
  "reveal.tier.warmingUp": "วอร์มอัพ",
  "reveal.tier.notBad": "ใช้ได้เลย",
  "reveal.tier.sharp": "เฉียบ",
  "reveal.tier.onFire": "มาแรง",
  "reveal.tier.superstar": "สุดยอด",
  "reveal.tier.recordBreaker": "ทำลายสถิติ",

  // --- Result screen -----------------------------------------------------
  "result.loading": "กำลังโหลด…",
  "result.loadingScore": "กำลังโหลดคะแนนของคุณ…",
  "result.notFound.title": "ไม่พบผลการเล่น",
  "result.notFound.detail": "ลิงก์คะแนนนี้อาจหมดอายุหรือพิมพ์ผิด",
  "result.notFound.action": "ไปเล่นเกม",
  "result.topScore": "🏆 คะแนนสูงสุด",
  "result.rank": "อันดับที่ {rank}",
  "result.playAgain": "เล่นอีกครั้ง",
  "result.pickAnother": "เลือกเกมอื่น",
  "result.won": "คุณได้รับ",
  "result.noClaimNote":
    "รอบนี้ไม่ได้ออกรหัสรับรางวัล — แสดงหน้าจอนี้ให้พนักงานดูแล้วทางร้านจะจัดการให้",
  "result.noPrize.title": "เกือบแล้ว!",
  "result.noPrize.body": "รอบนี้ยังไม่ได้รางวัล — ลองอีกสักรอบเพื่อทำคะแนนให้สูงขึ้น",

  // --- Leaderboard -------------------------------------------------------
  "board.title": "อันดับผู้เล่น",
  "board.loading": "กำลังโหลด…",
  "board.empty": "มาเป็นคนแรกบนกระดานกันเลย!",

  // --- Prize claim -------------------------------------------------------
  "claim.label.ready": "พร้อมรับรางวัล",
  "claim.label.collected": "รับแล้ว",
  "claim.label.expired": "หมดอายุ",
  "claim.note.ready": "แสดงรหัสนี้ที่เคาน์เตอร์เพื่อรับของรางวัล",
  "claim.note.collected": "รางวัลนี้รับไปเรียบร้อยแล้ว",
  "claim.note.expired": "รหัสนี้หมดอายุแล้ว หากคิดว่าไม่ถูกต้องกรุณาสอบถามพนักงาน",
  "claim.codeLabel": "รหัสรับรางวัล",
  "claim.collectBy": "รับได้ถึง {date}",
  "claim.collectedOn": "รับแล้วเมื่อ {date}",
  "claim.expiredOn": "หมดอายุเมื่อ {date}",

  // --- Copy button -------------------------------------------------------
  "copy.label": "รหัส",
  "copy.idle": "คัดลอก",
  "copy.copied": "คัดลอกแล้ว",
  "copy.failed": "ลองเลือกข้อความแทน",
  "copy.aria": "คัดลอก{label}",
  "copy.announceCopied": "คัดลอก{label}แล้ว",
  "copy.announceFailed": "คัดลอก{label}ไม่สำเร็จ",

  // --- Tap Fast ----------------------------------------------------------
  "tapFast.tap": "แตะ!",

  // --- Reaction Timer ----------------------------------------------------
  "reaction.now": "ตอนนี้!",
  "reaction.wait": "รอก่อน…",
  "reaction.tooSoon": "เร็วไป! เริ่มรอใหม่…",
  "reaction.tap": "แตะ!",
  "reaction.hold": "รอ",
  "reaction.ariaGo": "แตะเลย",
  "reaction.ariaWait": "รอสัญญาณแล้วค่อยแตะ",
  "reaction.hintGo": "พอวงกลมเปลี่ยนสีให้แตะทันที",
  "reaction.hintWait": "อย่าเพิ่งแตะจนกว่าวงกลมจะสว่าง",

  // --- Precision Stop ----------------------------------------------------
  "precision.aim": "หยุดให้ตรงกลางพอดี",
  "precision.hint": "ยิ่งหยุดใกล้กลาง คะแนนยิ่งน้อย",
  "precision.outOfTime": "หมดเวลา",
  "precision.offCentre": "ห่างจากกึ่งกลาง {off}",
  "precision.stop": "หยุด!",
  "precision.aria": "หยุดตัววิ่งให้ใกล้จุดกึ่งกลางของแทร็กที่สุด",
  "precision.timeLeft": "เวลาที่เหลือสำหรับหยุดตัววิ่ง",
  "precision.verdict.perfect": "เป๊ะ",
  "precision.verdict.deadOn": "ตรงเป้า",
  "precision.verdict.close": "ใกล้มาก",
  "precision.verdict.near": "ใกล้",
  "precision.verdict.wide": "ห่าง",
};
