"""
DMIXERAI
Readability Service

Real, computed readability metrics (Flesch Reading Ease / Flesch-Kincaid
Grade Level) — no AI self-reported scores, no fabricated numbers.
"""

import re

VOWELS = "aeiouy"


def count_syllables(word):
    word = re.sub(r"[^a-z]", "", word.lower())

    if not word:
        return 0

    syllables = 0
    prev_vowel = False

    for ch in word:
        is_vowel = ch in VOWELS
        if is_vowel and not prev_vowel:
            syllables += 1
        prev_vowel = is_vowel

    if word.endswith("e") and syllables > 1:
        syllables -= 1

    return max(syllables, 1)


def analyze_readability(text):
    plain = re.sub(r"```.*?```", " ", text, flags=re.DOTALL)
    plain = re.sub(r"[#*`_>|]", " ", plain)

    sentences = [s for s in re.split(r"[.!?]+", plain) if s.strip()]
    words = re.findall(r"[A-Za-z']+", plain)

    sentence_count = max(len(sentences), 1)
    word_count = max(len(words), 1)
    syllable_count = sum(count_syllables(w) for w in words) or 1

    flesch = 206.835 - 1.015 * (word_count / sentence_count) - 84.6 * (syllable_count / word_count)
    grade = 0.39 * (word_count / sentence_count) + 11.8 * (syllable_count / word_count) - 15.59

    flesch = round(max(0, min(100, flesch)), 1)
    grade = round(max(grade, 0), 1)

    if flesch >= 70:
        level = "Easy to read"
    elif flesch >= 50:
        level = "Moderately difficult"
    else:
        level = "Difficult / technical"

    return {
        "word_count": word_count,
        "sentence_count": sentence_count,
        "flesch_reading_ease": flesch,
        "flesch_kincaid_grade": grade,
        "level": level,
    }
