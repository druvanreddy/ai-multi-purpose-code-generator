"""
DMIXERAI — Central Groq AI Client
"""

import re
import time
from groq import Groq
from config import config

THINK_BLOCK_RE = re.compile(r"^\s*<think>.*?</think>\s*", re.DOTALL)


class GroqClient:

    def __init__(self):

        if not config.GROQ_API_KEY:

            raise ValueError(
                "\n❌ GROQ_API_KEY not found.\n"
                "Please update your .env file.\n"
            )

        self.client = Groq(
            api_key=config.GROQ_API_KEY
        )

        self.model = config.MODEL_NAME

    # --------------------------------------------------

    def set_model(self, model_name):

        self.model = model_name

    # --------------------------------------------------

    def get_model(self):

        return self.model

    # --------------------------------------------------

    def available_models(self):

        return [

            "openai/gpt-oss-120b",

            "openai/gpt-oss-20b",

            "qwen/qwen3.8-27b",

            "qwen/qwen3.6-27b"

        ]

    # --------------------------------------------------

    def generate_response(

        self,

        prompt,

        system_prompt,

        temperature=0.2,

        max_tokens=4096,

        stream=False

    ):

        completion = self.client.chat.completions.create(

            model=self.model,

            messages=[

                {
                    "role": "system",
                    "content": system_prompt
                },

                {
                    "role": "user",
                    "content": prompt
                }

            ],

            temperature=temperature,

            max_tokens=max_tokens,

            stream=stream

        )

        if stream:

            return completion

        content = completion.choices[0].message.content

        content = THINK_BLOCK_RE.sub("", content)

        return content.strip()

    # --------------------------------------------------

    def stream_response(

        self,

        prompt,

        system_prompt,

        temperature=0.2,

        max_tokens=4096,

        history=None

    ):

        try:

            messages = [{"role": "system", "content": system_prompt}]

            if history:
                for msg in history:
                    role = msg.get("role", "user")
                    content = msg.get("content", "")
                    if role in ("user", "assistant") and content.strip():
                        messages.append({"role": role, "content": content})

            messages.append({"role": "user", "content": prompt})

            stream = self.client.chat.completions.create(

                model=self.model,

                messages=messages,

                temperature=temperature,

                max_tokens=max_tokens,

                stream=True

            )

            pending = ""

            state = "lead"  # lead -> thinking|passthrough ; thinking -> passthrough

            for chunk in stream:

                if not chunk.choices:
                    continue

                delta = chunk.choices[0].delta.content

                if not delta:
                    continue

                pending += delta

                if state == "lead":

                    lead_stripped = pending.lstrip()

                    if not lead_stripped:
                        continue

                    if len(lead_stripped) < len("<think>") and "<think>".startswith(lead_stripped):
                        continue

                    if lead_stripped.startswith("<think>"):
                        state = "thinking"
                        idx = pending.find("<think>") + len("<think>")
                        pending = pending[idx:]
                    else:
                        state = "passthrough"

                if state == "thinking":

                    if "</think>" in pending:
                        pending = pending.split("</think>", 1)[1].lstrip("\n")
                        state = "passthrough"
                    else:
                        continue

                if pending:
                    yield pending
                    pending = ""

        except Exception as error:

            yield f"\n❌ {error}"

    # --------------------------------------------------

    def test_connection(self):

        try:

            start = time.time()

            response = self.generate_response(

                prompt="Say Hello",

                system_prompt="You are a helpful assistant."

            )

            end = time.time()

            return {

                "success": True,

                "message": response,

                "model": self.model,

                "response_time": round(end - start, 2)

            }

        except Exception as error:

            return {

                "success": False,

                "message": str(error)

            }

    # --------------------------------------------------

    def health_check(self):

        status = self.test_connection()

        return status["success"]


groq_ai = GroqClient()