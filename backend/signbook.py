"""Phrasebook-based speech -> Indian Sign Language mapping.

Demo-scope design: fixed phrasebook with fuzzy matching. The production
path replaces match_phrase() with a neural sign-language generation
model; the /speech-to-sign API contract stays identical.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from difflib import SequenceMatcher

_MATCH_THRESHOLD = 0.6


@dataclass(frozen=True)
class SignPhrase:
    phrase_id: str
    text: str
    gloss: tuple[str, ...]
    clip: str  # relative to frontend/public/, e.g. "signs/help.mp4"


PHRASEBOOK: tuple[SignPhrase, ...] = (
    SignPhrase("help", "i need help", ("HELP",), "signs/help.mp4"),
    SignPhrase("water", "i need water", ("WATER", "NEED"), "signs/water.mp4"),
    SignPhrase("hospital", "where is the hospital", ("HOSPITAL", "WHERE"), "signs/hospital.mp4"),
    SignPhrase("name", "my name is", ("MY", "NAME"), "signs/name.mp4"),
    SignPhrase("thank", "thank you", ("THANK-YOU",), "signs/thank_you.mp4"),
    SignPhrase("sorry", "i am sorry", ("SORRY",), "signs/sorry.mp4"),
    SignPhrase("yes", "yes", ("YES",), "signs/yes.mp4"),
    SignPhrase("no", "no", ("NO",), "signs/no.mp4"),
    SignPhrase("pain", "i have pain here", ("PAIN", "HERE"), "signs/pain.mp4"),
    SignPhrase("medicine", "i need medicine", ("MEDICINE", "NEED"), "signs/medicine.mp4"),
    SignPhrase("family", "call my family", ("FAMILY", "CALL"), "signs/call_family.mp4"),
    SignPhrase("understand", "i do not understand", ("UNDERSTAND", "NOT"), "signs/not_understand.mp4"),
)


def _normalize(text: str) -> str:
    return re.sub(r"[^a-z0-9 ]", "", text.lower()).strip()


def match_phrase(transcript: str) -> tuple[SignPhrase | None, float]:
    """Return (matched phrase, confidence). None if below threshold."""
    norm = _normalize(transcript)
    if not norm:
        return None, 0.0

    best: SignPhrase | None = None
    best_score = 0.0
    for entry in PHRASEBOOK:
        target = _normalize(entry.text)
        score = SequenceMatcher(None, norm, target).ratio()
        if target and target in norm:
            score = max(score, 0.85)
        if score > best_score:
            best, best_score = entry, score

    if best_score >= _MATCH_THRESHOLD:
        return best, best_score
    return None, best_score
