"""
DMIXERAI
Database Service
"""

import sqlite3
from pathlib import Path

DATABASE = Path("database/app.db")


class Database:

    def __init__(self):

        DATABASE.parent.mkdir(exist_ok=True)

        self.connection = sqlite3.connect(
            DATABASE,
            check_same_thread=False
        )

        self.cursor = self.connection.cursor()

        self.create_tables()

    # --------------------------------------------------

    def create_tables(self):

        self.cursor.execute("""
        CREATE TABLE IF NOT EXISTS history(

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            feature TEXT,

            prompt TEXT,

            response TEXT,

            created_at TEXT

        )
        """)

        self.cursor.execute("""
        CREATE TABLE IF NOT EXISTS analytics(

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            feature TEXT,

            response_time REAL,

            created_at TEXT

        )
        """)

        self.cursor.execute("""
        CREATE TABLE IF NOT EXISTS detector_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT,
            word_count INTEGER,
            ai_probability REAL,
            band TEXT,
            confidence TEXT,
            flesch_reading_ease REAL,
            flesch_kincaid_grade REAL,
            burstiness_cv REAL,
            type_token_ratio REAL,
            repetition_ratio REAL,
            contraction_ratio REAL,
            hapax_ratio REAL,
            ai_phrase_density REAL,
            consecutive_similar_ratio REAL,
            opener_diversity REAL,
            transition_diversity REAL,
            passive_voice_ratio REAL,
            filler_ratio REAL,
            structure_score REAL,
            mechanics_score REAL,
            total_citations INTEGER,
            text_preview TEXT,
            full_analysis TEXT,
            created_at TEXT
        )
        """)

        self.connection.commit()

    # --------------------------------------------------

    def save_history(

        self,

        feature,

        prompt,

        response,

        created_at

    ):

        self.cursor.execute(

            """
            INSERT INTO history(

                feature,

                prompt,

                response,

                created_at

            )

            VALUES(?,?,?,?)

            """,

            (

                feature,

                prompt,

                response,

                created_at

            )

        )

        self.connection.commit()

    # --------------------------------------------------

    def save_analytics(

        self,

        feature,

        response_time,

        created_at

    ):

        self.cursor.execute(

            """
            INSERT INTO analytics(

                feature,

                response_time,

                created_at

            )

            VALUES(?,?,?)

            """,

            (

                feature,

                response_time,

                created_at

            )

        )

        self.connection.commit()

    # --------------------------------------------------

    def get_history(self):

        self.cursor.execute(

            """
            SELECT

            id,

            feature,

            prompt,

            response,

            created_at

            FROM history

            ORDER BY id DESC

            """

        )

        return self.cursor.fetchall()

    # --------------------------------------------------

    def get_analytics(self):

        self.cursor.execute(

            """
            SELECT

            feature,

            COUNT(*)

            FROM analytics

            GROUP BY feature

            """

        )

        return self.cursor.fetchall()

    # --------------------------------------------------

    def clear_history(self):

        self.cursor.execute(

            "DELETE FROM history"

        )

        self.connection.commit()

    # --------------------------------------------------

    def clear_analytics(self):

        self.cursor.execute(

            "DELETE FROM analytics"

        )

        self.connection.commit()

    # --------------------------------------------------

    def save_detector_history(self, filename, analysis, text_preview, full_json):
        ai = analysis.get("ai_likelihood", {})
        stylo = analysis.get("stylometry", {})
        read = analysis.get("readability", {})
        struct = analysis.get("structure", {})
        mech = analysis.get("mechanics", {})
        stats = analysis.get("stats", {})
        cit = analysis.get("citations", {})
        from datetime import datetime
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        self.cursor.execute("""
            INSERT INTO detector_history (
                filename, word_count, ai_probability, band, confidence,
                flesch_reading_ease, flesch_kincaid_grade,
                burstiness_cv, type_token_ratio, repetition_ratio,
                contraction_ratio, hapax_ratio, ai_phrase_density,
                consecutive_similar_ratio, opener_diversity,
                transition_diversity, passive_voice_ratio, filler_ratio,
                structure_score, mechanics_score, total_citations,
                text_preview, full_analysis, created_at
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            filename,
            stats.get("word_count", 0),
            ai.get("estimated_ai_probability", 0),
            ai.get("band", ""),
            ai.get("confidence", ""),
            read.get("flesch_reading_ease", 0),
            read.get("flesch_kincaid_grade", 0),
            stylo.get("burstiness_cv", 0),
            stylo.get("type_token_ratio", 0),
            stylo.get("repetition_ratio", 0),
            stylo.get("contraction_ratio", 0),
            stylo.get("hapax_ratio", 0),
            stylo.get("ai_phrase_density", 0),
            stylo.get("consecutive_similar_ratio", 0),
            stylo.get("opener_diversity", 0),
            stylo.get("transition_diversity", 0),
            stylo.get("passive_voice_ratio", 0),
            stylo.get("filler_ratio", 0),
            struct.get("structure_score", 0),
            mech.get("mechanics_score", 0),
            cit.get("total_citations", 0),
            text_preview[:500],
            full_json,
            now,
        ))
        self.connection.commit()

    def get_detector_history(self):
        self.cursor.execute("""
            SELECT id, filename, word_count, ai_probability, band, confidence,
                   flesch_reading_ease, flesch_kincaid_grade,
                   burstiness_cv, type_token_ratio, contraction_ratio,
                   hapax_ratio, ai_phrase_density, opener_diversity,
                   structure_score, mechanics_score, total_citations,
                   text_preview, created_at
            FROM detector_history ORDER BY id DESC
        """)
        rows = self.cursor.fetchall()
        return [
            {
                "id": r[0], "filename": r[1], "word_count": r[2],
                "ai_probability": r[3], "band": r[4], "confidence": r[5],
                "flesch_reading_ease": r[6], "flesch_kincaid_grade": r[7],
                "burstiness_cv": r[8], "type_token_ratio": r[9],
                "contraction_ratio": r[10], "hapax_ratio": r[11],
                "ai_phrase_density": r[12], "opener_diversity": r[13],
                "structure_score": r[14], "mechanics_score": r[15],
                "total_citations": r[16], "text_preview": r[17],
                "created_at": r[18],
            }
            for r in rows
        ]

    def get_detector_entry(self, entry_id):
        self.cursor.execute(
            "SELECT full_analysis FROM detector_history WHERE id = ?",
            (entry_id,),
        )
        row = self.cursor.fetchone()
        return row[0] if row else None

    def delete_detector_entry(self, entry_id):
        self.cursor.execute("DELETE FROM detector_history WHERE id = ?", (entry_id,))
        self.connection.commit()

    def clear_detector_history(self):
        self.cursor.execute("DELETE FROM detector_history")
        self.connection.commit()

    def close(self):

        self.connection.close()


db = Database()