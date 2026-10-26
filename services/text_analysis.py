"""
DMIXERAI
Text Analysis Engine

Real, directly-computed stylometric, readability, and citation statistics —
no trained ML model, no invented numbers. Every value here is arithmetic
over the actual text.

The "AI-writing likelihood" score is an explicit, documented HEURISTIC
ensemble of these signals (burstiness, vocabulary richness, repetition,
transition uniformity, paragraph uniformity) — not a trained/calibrated
classifier. It is presented to the user with that caveat everywhere it's
shown. See README.md for the full disclosure.
"""

import re
import statistics
from collections import Counter

from services.readability import count_syllables

STOPWORDS = {
    "a", "an", "the", "and", "or", "but", "nor", "so", "yet", "for", "of",
    "in", "on", "at", "to", "from", "by", "with", "about", "as", "into",
    "like", "through", "after", "over", "between", "out", "against",
    "during", "without", "before", "under", "around", "among", "is", "are",
    "was", "were", "be", "been", "being", "am", "have", "has", "had",
    "do", "does", "did", "will", "would", "shall", "should", "may", "might",
    "must", "can", "could", "this", "that", "these", "those", "i", "you",
    "he", "she", "it", "we", "they", "me", "him", "her", "us", "them",
    "my", "your", "his", "its", "our", "their", "not", "no", "if", "then",
    "than", "too", "very", "just", "there", "here", "when", "where", "why",
    "how", "all", "each", "few", "more", "most", "other", "some", "such",
    "only", "own", "same", "which", "who", "whom", "what",
}

CONTRACTIONS = {
    "i'm", "i've", "i'll", "i'd", "you're", "you've", "you'll", "you'd",
    "he's", "she's", "it's", "we're", "we've", "we'll", "we'd",
    "they're", "they've", "they'll", "they'd", "that's", "who's",
    "what's", "there's", "here's", "where's", "how's", "isn't", "aren't",
    "wasn't", "weren't", "hasn't", "haven't", "hadn't", "doesn't", "don't",
    "didn't", "won't", "wouldn't", "shan't", "shouldn't", "can't", "cannot",
    "couldn't", "mustn't", "let's", "that'll", "who'll", "what'll",
    "it'll", "ain't",
}

FILLER_WORDS = {
    "actually", "basically", "honestly", "literally", "obviously",
    "essentially", "frankly", "simply", "really", "clearly",
    "certainly", "definitely", "absolutely", "totally", "utterly",
    "quite", "rather", "somewhat", "perhaps", "maybe", "probably",
    "possibly", "apparently", "presumably", "supposedly", "arguably",
    "admittedly", "incidentally", "interestingly", "surprisingly",
    "importantly", "significantly", "naturally", "understandably",
}

AI_HEDGE_PHRASES = [
    "it is important to note", "it is worth noting",
    "it should be noted", "it is crucial to",
    "in today's world", "in today's society",
    "plays a crucial role", "plays a vital role",
    "in the realm of", "in the context of",
    "a comprehensive understanding", "a deeper understanding",
    "a wide range of", "a variety of",
    "it is essential to", "it is imperative to",
    "delve into", "delve deeper",
    "leverage", "utilize",
    "multifaceted", "overarching",
    "paradigm", "synergy",
    "holistic approach", "nuanced understanding",
]

TRANSITIONS = [
    "however", "furthermore", "moreover", "additionally", "in addition",
    "therefore", "thus", "consequently", "as a result", "in conclusion",
    "in summary", "overall", "on the other hand", "in contrast",
    "nevertheless", "nonetheless", "for example", "for instance",
    "specifically", "in particular", "importantly", "notably", "meanwhile",
    "subsequently", "accordingly", "hence", "in fact", "indeed",
    "first", "second", "third", "finally", "next", "then", "also",
]

PASSIVE_RE = re.compile(
    r"\b(am|is|are|was|were|be|been|being)\s+(\w+ed|\w+en|shown|done|given|"
    r"taken|made|written|seen|known|found|used|built|held|told|sent|kept|"
    r"brought|bought|thought|caught|taught)\b",
    re.IGNORECASE,
)

CITATION_NUMERIC_RE = re.compile(r"\[(\d+(?:\s*[,\-]\s*\d+)*)\]")
CITATION_AUTHOR_YEAR_RE = re.compile(
    r"\(([A-Z][a-zA-Z\-]+(?:\s+(?:et al\.|and|&)\s+[A-Z][a-zA-Z\-]+)?,?\s+\d{4}[a-z]?)\)"
)

SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9\"'])")
WORD_RE = re.compile(r"[A-Za-z']+")


# =====================================================
# TEXT SEGMENTATION
# =====================================================

def _clean(text):
    return re.sub(r"```.*?```", " ", text, flags=re.DOTALL)


def split_paragraphs(text):
    paras = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    return paras if paras else ([text.strip()] if text.strip() else [])


def split_sentences(text):
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return []
    sentences = SENTENCE_SPLIT_RE.split(text)
    return [s.strip() for s in sentences if s.strip()]


def split_words(text):
    return WORD_RE.findall(text)


# =====================================================
# BASIC STATS
# =====================================================

def basic_stats(text):
    plain = _clean(text)
    words = split_words(plain)
    sentences = split_sentences(plain)
    paragraphs = split_paragraphs(text)

    word_count = len(words)
    char_count = len(text)
    sentence_count = max(len(sentences), 1)
    paragraph_count = max(len(paragraphs), 1)

    return {
        "word_count": word_count,
        "char_count": char_count,
        "sentence_count": sentence_count,
        "paragraph_count": paragraph_count,
        "reading_time_minutes": round(max(word_count / 220, 0.1), 1),
        "language": detect_language(words),
    }


def detect_language(words):
    if len(words) < 10:
        return "Unknown (too short)"
    sample = [w.lower() for w in words[:500]]
    stopword_hits = sum(1 for w in sample if w in STOPWORDS)
    ratio = stopword_hits / max(len(sample), 1)
    return "English" if ratio >= 0.12 else "Non-English or mixed (unconfirmed)"


# =====================================================
# READABILITY (extends services/readability.py with more indices)
# =====================================================

def readability_suite(text):
    plain = _clean(text)
    words = split_words(plain)
    sentences = split_sentences(plain)

    word_count = max(len(words), 1)
    sentence_count = max(len(sentences), 1)
    syllable_counts = [count_syllables(w) for w in words] or [1]
    syllable_count = sum(syllable_counts)
    complex_words = sum(1 for c in syllable_counts if c >= 3)
    letters = sum(len(w) for w in words) or 1

    avg_words_per_sentence = word_count / sentence_count
    avg_syllables_per_word = syllable_count / word_count

    flesch = 206.835 - 1.015 * avg_words_per_sentence - 84.6 * avg_syllables_per_word
    fk_grade = 0.39 * avg_words_per_sentence + 11.8 * avg_syllables_per_word - 15.59
    gunning_fog = 0.4 * (avg_words_per_sentence + 100 * (complex_words / word_count))
    smog = 1.043 * ((complex_words * (30 / sentence_count)) ** 0.5) + 3.1291
    coleman_liau = (5.89 * (letters / word_count)) - (0.3 * (sentence_count / word_count)) - 15.8
    ari = 4.71 * (letters / word_count) + 0.5 * avg_words_per_sentence - 21.43

    return {
        "flesch_reading_ease": round(max(0, min(100, flesch)), 1),
        "flesch_kincaid_grade": round(max(fk_grade, 0), 1),
        "gunning_fog_index": round(max(gunning_fog, 0), 1),
        "smog_index": round(max(smog, 0), 1),
        "coleman_liau_index": round(max(coleman_liau, 0), 1),
        "automated_readability_index": round(max(ari, 0), 1),
        "avg_words_per_sentence": round(avg_words_per_sentence, 1),
        "avg_syllables_per_word": round(avg_syllables_per_word, 2),
        "complex_word_ratio": round(complex_words / word_count, 3),
    }


# =====================================================
# STYLOMETRY
# =====================================================

def stylometry(text):
    plain = _clean(text)
    words = split_words(plain)
    sentences = split_sentences(plain)
    paragraphs = split_paragraphs(text)

    lower_words = [w.lower() for w in words]
    word_count = max(len(words), 1)

    sentence_lengths = [len(split_words(s)) for s in sentences] or [0]
    paragraph_lengths = [len(split_words(p)) for p in paragraphs] or [0]

    sent_mean = statistics.mean(sentence_lengths)
    sent_stdev = statistics.pstdev(sentence_lengths) if len(sentence_lengths) > 1 else 0
    burstiness_cv = round(sent_stdev / sent_mean, 3) if sent_mean else 0

    para_mean = statistics.mean(paragraph_lengths)
    para_stdev = statistics.pstdev(paragraph_lengths) if len(paragraph_lengths) > 1 else 0
    para_cv = round(para_stdev / para_mean, 3) if para_mean else 0

    unique_words = set(lower_words)
    type_token_ratio = round(len(unique_words) / word_count, 3)

    content_words = [w for w in lower_words if w not in STOPWORDS]
    lexical_density = round(len(content_words) / word_count, 3)

    avg_word_length = round(sum(len(w) for w in words) / word_count, 2)

    passive_hits = len(PASSIVE_RE.findall(plain))
    passive_ratio = round(passive_hits / max(len(sentences), 1), 3)

    lower_text = plain.lower()
    found_transitions = Counter()
    for phrase in TRANSITIONS:
        count = len(re.findall(r"\b" + re.escape(phrase) + r"\b", lower_text))
        if count:
            found_transitions[phrase] = count
    transition_total = sum(found_transitions.values())
    transition_diversity = round(len(found_transitions) / transition_total, 3) if transition_total else 1.0

    trigrams = Counter(
        tuple(lower_words[i:i + 3]) for i in range(len(lower_words) - 2)
    )
    repeated_trigrams = [
        (" ".join(k), v) for k, v in trigrams.most_common(8) if v >= 3
    ]
    repetition_ratio = round(
        sum(v for _, v in repeated_trigrams) / word_count, 3
    ) if word_count else 0

    openers = Counter(split_words(s)[0].lower() for s in sentences if split_words(s))
    repeated_openers = [(w, c) for w, c in openers.most_common(5) if c >= 3]

    punctuation_counts = Counter(re.findall(r"[.!?,;:—\-]", plain))
    punctuation_diversity = len(punctuation_counts)

    normalized_text = plain.replace("’", "'").replace("‘", "'")
    contraction_words = WORD_RE.findall(normalized_text.lower())
    contraction_hits = sum(1 for w in contraction_words if w in CONTRACTIONS)
    contraction_ratio = round(contraction_hits / word_count, 4)

    hapax = sum(1 for w, c in Counter(lower_words).items() if c == 1 and w not in STOPWORDS)
    hapax_ratio = round(hapax / max(len(unique_words), 1), 3)

    filler_hits = sum(1 for w in lower_words if w in FILLER_WORDS)
    filler_ratio = round(filler_hits / word_count, 4)

    ai_phrase_hits = 0
    for phrase in AI_HEDGE_PHRASES:
        ai_phrase_hits += len(re.findall(re.escape(phrase), lower_text))
    ai_phrase_density = round(ai_phrase_hits / max(word_count / 100, 1), 3)

    consecutive_similar = 0
    for i in range(len(sentence_lengths) - 1):
        a, b = sentence_lengths[i], sentence_lengths[i + 1]
        if a and b and abs(a - b) / max(a, b) < 0.15:
            consecutive_similar += 1
    consecutive_similar_ratio = round(
        consecutive_similar / max(len(sentence_lengths) - 1, 1), 3
    )

    opener_set = set(split_words(s)[0].lower() for s in sentences if split_words(s))
    opener_diversity = round(len(opener_set) / max(len(sentences), 1), 3)

    return {
        "sentence_count": len(sentences),
        "avg_sentence_length": round(sent_mean, 1),
        "sentence_length_stdev": round(sent_stdev, 2),
        "burstiness_cv": burstiness_cv,
        "paragraph_count": len(paragraphs),
        "avg_paragraph_length": round(para_mean, 1),
        "paragraph_length_cv": para_cv,
        "unique_word_count": len(unique_words),
        "type_token_ratio": type_token_ratio,
        "lexical_density": lexical_density,
        "avg_word_length": avg_word_length,
        "passive_voice_ratio": passive_ratio,
        "transition_phrases_found": dict(found_transitions.most_common(10)),
        "transition_diversity": transition_diversity,
        "repeated_trigrams": repeated_trigrams,
        "repetition_ratio": repetition_ratio,
        "repeated_sentence_openers": repeated_openers,
        "punctuation_diversity": punctuation_diversity,
        "contraction_ratio": contraction_ratio,
        "hapax_ratio": hapax_ratio,
        "filler_ratio": filler_ratio,
        "ai_phrase_density": ai_phrase_density,
        "consecutive_similar_ratio": consecutive_similar_ratio,
        "opener_diversity": opener_diversity,
    }


# =====================================================
# CITATION ANALYSIS
# =====================================================

def citation_analysis(text, word_count):
    numeric = CITATION_NUMERIC_RE.findall(text)
    author_year = CITATION_AUTHOR_YEAR_RE.findall(text)

    numeric_numbers = set()
    for group in numeric:
        for part in re.split(r"[,\-]", group):
            part = part.strip()
            if part.isdigit():
                numeric_numbers.add(int(part))

    gaps = []
    if numeric_numbers:
        full_range = range(1, max(numeric_numbers) + 1)
        gaps = [n for n in full_range if n not in numeric_numbers]

    style = "none"
    if numeric and author_year:
        style = "mixed"
    elif numeric:
        style = "numeric"
    elif author_year:
        style = "author-year"

    total_citations = len(numeric) + len(author_year)
    density = round((total_citations / max(word_count, 1)) * 1000, 2)

    return {
        "style_detected": style,
        "numeric_citation_count": len(numeric),
        "author_year_citation_count": len(author_year),
        "total_citations": total_citations,
        "citation_density_per_1000_words": density,
        "unique_numeric_markers": sorted(numeric_numbers),
        "numbering_gaps": gaps,
        "has_citations": total_citations > 0,
    }


# =====================================================
# WRITING MECHANICS (real, narrow — not full grammar checking)
# =====================================================

def writing_mechanics(text):
    plain = _clean(text)
    sentences = split_sentences(plain)
    issues = []

    repeated_word_hits = re.findall(r"\b(\w+)\s+\1\b", plain, flags=re.IGNORECASE)
    if repeated_word_hits:
        issues.append({"type": "Repeated word", "count": len(repeated_word_hits), "example": repeated_word_hits[0]})

    double_space_hits = len(re.findall(r"[^\S\n]{2,}", plain))
    if double_space_hits:
        issues.append({"type": "Double spacing", "count": double_space_hits, "example": None})

    lowercase_start = sum(1 for s in sentences if s and s[0].islower())
    if lowercase_start:
        issues.append({"type": "Sentence starts lowercase", "count": lowercase_start, "example": None})

    run_on = [s for s in sentences if len(split_words(s)) > 40]
    if run_on:
        issues.append({"type": "Very long / run-on sentence (40+ words)", "count": len(run_on), "example": run_on[0][:120] + "…"})

    no_end_punct = sum(1 for s in sentences if s and s[-1] not in ".!?\"'")
    if no_end_punct > 1:
        issues.append({"type": "Sentence missing end punctuation", "count": no_end_punct, "example": None})

    total_issue_count = sum(i["count"] for i in issues)
    word_count = max(len(split_words(plain)), 1)
    issues_per_1000 = round((total_issue_count / word_count) * 1000, 2)

    mechanics_score = round(max(0, 100 - issues_per_1000 * 4), 1)

    return {
        "issues": issues,
        "total_issue_count": total_issue_count,
        "issues_per_1000_words": issues_per_1000,
        "mechanics_score": mechanics_score,
    }


# =====================================================
# AI-WRITING LIKELIHOOD (heuristic ensemble — explicitly not a trained classifier)
# =====================================================

def _band(value, low_thresh, high_thresh, invert=False):
    """Map a raw value to a 0-1 'more AI-like' signal via linear interpolation."""
    if high_thresh == low_thresh:
        return 0.5
    t = (value - low_thresh) / (high_thresh - low_thresh)
    t = max(0.0, min(1.0, t))
    return (1 - t) if invert else t


def ai_likelihood(style, word_count):
    signals = {}

    signals["low_burstiness"] = round(_band(style["burstiness_cv"], 0.20, 0.60, invert=True), 3)
    signals["low_vocabulary_richness"] = round(_band(style["type_token_ratio"], 0.30, 0.60, invert=True), 3)
    signals["repetition"] = round(_band(style["repetition_ratio"], 0.0, 0.04), 3)
    signals["transition_uniformity"] = round(_band(style["transition_diversity"], 0.25, 0.90, invert=True), 3)
    signals["paragraph_uniformity"] = round(_band(style["paragraph_length_cv"], 0.15, 0.55, invert=True), 3)

    signals["low_contraction_use"] = round(_band(style["contraction_ratio"], 0.0, 0.02, invert=True), 3)
    signals["low_hapax_ratio"] = round(_band(style["hapax_ratio"], 0.40, 0.70, invert=True), 3)
    signals["ai_phrase_density"] = round(_band(style["ai_phrase_density"], 0.0, 2.0), 3)
    signals["consecutive_similar_sentences"] = round(_band(style["consecutive_similar_ratio"], 0.10, 0.40), 3)
    signals["low_opener_diversity"] = round(_band(style["opener_diversity"], 0.40, 0.85, invert=True), 3)

    weights = {
        "low_burstiness": 0.16,
        "low_vocabulary_richness": 0.12,
        "repetition": 0.10,
        "transition_uniformity": 0.08,
        "paragraph_uniformity": 0.08,
        "low_contraction_use": 0.10,
        "low_hapax_ratio": 0.10,
        "ai_phrase_density": 0.10,
        "consecutive_similar_sentences": 0.08,
        "low_opener_diversity": 0.08,
    }

    weighted = sum(signals[k] * weights[k] for k in weights)

    if word_count < 100:
        dampen = 0.6
    elif word_count < 250:
        dampen = 0.8
    else:
        dampen = 1.0
    score = round(weighted * 100 * dampen, 1)
    score = max(0.0, min(100.0, score))

    if score >= 65:
        band = "High"
    elif score >= 35:
        band = "Medium"
    else:
        band = "Low"

    if word_count < 150:
        confidence = "Low"
    elif word_count < 500:
        confidence = "Medium"
    else:
        confidence = "High"

    contributing = sorted(
        (
            {"signal": k.replace("_", " ").title(), "strength": v, "weight": weights[k]}
            for k, v in signals.items()
        ),
        key=lambda x: x["strength"] * x["weight"],
        reverse=True,
    )

    return {
        "estimated_ai_probability": score,
        "band": band,
        "human_probability_complement": round(100 - score, 1),
        "confidence": confidence,
        "signals": signals,
        "contributing_factors": contributing,
        "methodology": (
            "Heuristic ensemble of ten writing-pattern signals — sentence-length "
            "burstiness, vocabulary richness, phrase repetition, transition-word "
            "uniformity, paragraph-length uniformity, contraction usage, hapax "
            "legomena ratio, AI hedge-phrase density, consecutive similar sentence "
            "lengths, and sentence-opener diversity. Short texts (<250 words) are "
            "dampened to reduce false positives. This is NOT a trained AI-detection "
            "classifier and has no validated accuracy figure. It is a statistical "
            "estimate only and should never be treated as proof of AI or human "
            "authorship."
        ),
    }


# =====================================================
# DOCUMENT STRUCTURE SCORE (heuristic composite)
# =====================================================

def structure_score(readability, style):
    readability_component = max(0, min(100, readability["flesch_reading_ease"]))
    variety_component = min(100, style["type_token_ratio"] * 150)
    burstiness_component = min(100, style["burstiness_cv"] * 150)
    balance_component = max(0, 100 - style["paragraph_length_cv"] * 80)

    score = round(
        readability_component * 0.35
        + variety_component * 0.25
        + burstiness_component * 0.25
        + balance_component * 0.15,
        1,
    )

    return {
        "structure_score": score,
        "components": {
            "readability": round(readability_component, 1),
            "vocabulary_variety": round(variety_component, 1),
            "sentence_variety": round(burstiness_component, 1),
            "paragraph_balance": round(balance_component, 1),
        },
    }


# =====================================================
# PARAGRAPH-LEVEL BREAKDOWN
# =====================================================

def paragraph_breakdown(text):
    paragraphs = split_paragraphs(text)
    results = []

    all_lengths = [len(split_words(p)) for p in paragraphs] or [1]
    mean_len = statistics.mean(all_lengths)

    for p in paragraphs:
        words = split_words(p)
        sentences = split_sentences(p)
        sent_lengths = [len(split_words(s)) for s in sentences] or [0]
        local_stdev = statistics.pstdev(sent_lengths) if len(sent_lengths) > 1 else 0
        local_mean = statistics.mean(sent_lengths) if sent_lengths else 0
        local_cv = (local_stdev / local_mean) if local_mean else 0

        deviation = abs(len(words) - mean_len) / mean_len if mean_len else 0
        flag_score = round(min(1.0, (1 - min(local_cv / 0.5, 1)) * 0.6 + min(deviation, 1) * 0.0), 2)

        results.append({
            "text": p,
            "preview": p[:140] + ("…" if len(p) > 140 else ""),
            "word_count": len(words),
            "sentence_count": len(sentences),
            "flag_score": flag_score,
        })

    return results


# =====================================================
# FULL ANALYSIS
# =====================================================

def analyze(text):
    stats = basic_stats(text)
    readability = readability_suite(text)
    style = stylometry(text)
    citations = citation_analysis(text, stats["word_count"])
    mechanics = writing_mechanics(text)
    ai = ai_likelihood(style, stats["word_count"])
    structure = structure_score(readability, style)
    paragraphs = paragraph_breakdown(text)

    return {
        "stats": stats,
        "readability": readability,
        "stylometry": style,
        "citations": citations,
        "mechanics": mechanics,
        "ai_likelihood": ai,
        "structure": structure,
        "paragraphs": paragraphs,
    }
