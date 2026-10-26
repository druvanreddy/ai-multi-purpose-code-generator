"""
=========================================================
DMIXERAI
main.py
=========================================================

FastAPI backend serving the API and the static frontend.
"""

import csv
import io
import json
import re
import time
import zipfile
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from config import config
from services.database import db
from services.document_extract import ExtractionError
from services.document_extract import extract_text as extract_document_text
from services.file_handler import extract_text
from services.groq_client import groq_ai
from services.logger import logger
from services.prompts import SYSTEM_PROMPT
from services.readability import analyze_readability
from services.report_export import build_docx, build_pdf
from services.text_analysis import analyze as analyze_document

app = FastAPI(title=config.APP_NAME, version=config.VERSION)


# =====================================================
# REQUEST MODELS
# =====================================================

class ChatRequest(BaseModel):
    message: str
    history: list = []
    model: Optional[str] = None
    temperature: float = 0.2
    max_tokens: int = 4096


class CodeGenerateRequest(BaseModel):
    language: str
    framework: str = ""
    project_type: str
    task: str
    include_tests: bool = False
    model: Optional[str] = None
    temperature: float = 0.2
    max_tokens: int = 4096


class DebugRequest(BaseModel):
    language: str
    code: str
    model: Optional[str] = None
    temperature: float = 0.2
    max_tokens: int = 4096


class ExplainRequest(BaseModel):
    level: str
    code: str
    model: Optional[str] = None
    temperature: float = 0.2
    max_tokens: int = 4096


class OptimizeRequest(BaseModel):
    code: str
    goals: list[str] = []
    model: Optional[str] = None
    temperature: float = 0.2
    max_tokens: int = 4096


class CodeActionRequest(BaseModel):
    language: str
    code: str
    model: Optional[str] = None
    temperature: float = 0.2
    max_tokens: int = 4096


class CommitRequest(BaseModel):
    diff: str
    model: Optional[str] = None
    temperature: float = 0.2
    max_tokens: int = 2048


class ProjectRequest(BaseModel):
    name: str
    language: str
    framework: str = ""
    description: str
    model: Optional[str] = None
    temperature: float = 0.2
    max_tokens: int = 8192


class SQLRequest(BaseModel):
    description: str
    dialect: str = "PostgreSQL"
    model: Optional[str] = None
    temperature: float = 0.2
    max_tokens: int = 4096


class ReadmeRequest(BaseModel):
    details: str
    model: Optional[str] = None
    temperature: float = 0.2
    max_tokens: int = 4096


class DocsRequest(BaseModel):
    details: str
    model: Optional[str] = None
    temperature: float = 0.2
    max_tokens: int = 4096


class TestsRequest(BaseModel):
    language: str
    code: str
    model: Optional[str] = None
    temperature: float = 0.2
    max_tokens: int = 6144


class ApiGeneratorRequest(BaseModel):
    language: str
    framework: str = ""
    description: str
    model: Optional[str] = None
    temperature: float = 0.2
    max_tokens: int = 8192


class DatabaseDesignRequest(BaseModel):
    description: str
    model: Optional[str] = None
    temperature: float = 0.2
    max_tokens: int = 4096


class ArchitectureRequest(BaseModel):
    description: str
    model: Optional[str] = None
    temperature: float = 0.2
    max_tokens: int = 4096


class DockerRequest(BaseModel):
    description: str
    language: str = ""
    framework: str = ""
    model: Optional[str] = None
    temperature: float = 0.2
    max_tokens: int = 4096


class ZipExportRequest(BaseModel):
    content: str
    project_name: str = "project"


class ReportTocRequest(BaseModel):
    topic: str
    report_type: str
    template: str
    model: Optional[str] = None


class ReportChapterRequest(BaseModel):
    topic: str
    report_type: str
    chapter_title: str
    subsections: list[str] = []
    chapter_number: int = 1
    total_chapters: int = 1
    word_target: int = 800
    language: str = "English"
    style: str = "Professional"
    citation_style: str = "IEEE"
    previous_context: str = ""
    citation_start: int = 1
    model: Optional[str] = None
    temperature: float = 0.3
    max_tokens: int = 4096


class ReportEditRequest(BaseModel):
    content: str
    instruction: str
    model: Optional[str] = None
    temperature: float = 0.3
    max_tokens: int = 4096


class ReportReferencesRequest(BaseModel):
    combined_text: str
    citation_style: str = "IEEE"
    model: Optional[str] = None
    temperature: float = 0.2
    max_tokens: int = 3000


class ReadabilityRequest(BaseModel):
    text: str


class ReportChapterOut(BaseModel):
    title: str
    content: str


class ReportExportRequest(BaseModel):
    title: str
    chapters: list[ReportChapterOut]
    references: str = ""


class DetectTextRequest(BaseModel):
    text: str


class DetectInsightsRequest(BaseModel):
    text: str
    analysis: dict
    model: Optional[str] = None
    temperature: float = 0.3
    max_tokens: int = 4096


class DetectHumanizeRequest(BaseModel):
    text: str
    weaknesses: list[str] = []
    model: Optional[str] = None
    temperature: float = 0.5
    max_tokens: int = 4096


class DetectExportRequest(BaseModel):
    filename: str = "document-analysis"
    text: str
    analysis: dict
    insights: str = ""


# =====================================================
# HELPERS
# =====================================================

def run_generation(feature, prompt, model=None, temperature=0.2, max_tokens=4096):
    if model:
        groq_ai.set_model(model)

    start = time.time()

    try:
        result = groq_ai.generate_response(
            prompt,
            SYSTEM_PROMPT,
            temperature=temperature,
            max_tokens=max_tokens,
        )
    except Exception as error:
        logger.error(f"{feature} failed: {error}")
        raise HTTPException(status_code=502, detail=f"Groq error: {error}")

    elapsed = round(time.time() - start, 2)

    now = datetime.now().strftime("%d-%m-%Y %H:%M:%S")

    db.save_history(feature, prompt[:500], result, now)
    db.save_analytics(feature, elapsed, now)

    logger.info(f"{feature} generated in {elapsed}s")

    return result, elapsed


# =====================================================
# STATUS / MODELS
# =====================================================

@app.get("/api/status")
def get_status():
    status = groq_ai.test_connection()

    return {
        "app_name": config.APP_NAME,
        "version": config.VERSION,
        "model": groq_ai.get_model(),
        **status,
    }


@app.get("/api/models")
def get_models():
    return {"models": groq_ai.available_models()}


# =====================================================
# CHAT (streaming)
# =====================================================

@app.post("/api/chat")
def chat(request: ChatRequest):
    if request.model:
        groq_ai.set_model(request.model)

    def event_stream():
        full_response = ""
        start = time.time()

        for chunk in groq_ai.stream_response(
            prompt=request.message,
            system_prompt=SYSTEM_PROMPT,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
            history=request.history,
        ):
            full_response += chunk
            yield chunk

        elapsed = round(time.time() - start, 2)
        now = datetime.now().strftime("%d-%m-%Y %H:%M:%S")

        db.save_history("Chat", request.message[:500], full_response, now)
        db.save_analytics("Chat", elapsed, now)

    return StreamingResponse(event_stream(), media_type="text/plain")


# =====================================================
# CODE GENERATOR / DEBUG / EXPLAIN / OPTIMIZE
# =====================================================

@app.post("/api/code/generate")
def code_generate(request: CodeGenerateRequest):
    tests_line = (
        "9. Include a companion test file/section using the language's standard "
        "or most idiomatic testing tool, covering the happy path plus at least "
        "one edge case."
        if request.include_tests
        else ""
    )

    prompt = f"""
Generate production-ready code.

Programming Language:
{request.language}

Framework:
{request.framework or "None specified — pick nothing unnecessary, plain " + request.language + " unless the task implies a framework."}

Project Type:
{request.project_type}

Task:
{request.task}

Requirements:

1. Write complete, runnable code — no placeholders, no "TODO", no omitted sections.
2. Follow current idiomatic conventions for {request.language}{f" and {request.framework}" if request.framework else ""}.
3. Add type annotations/type hints where the language supports them.
4. Validate inputs and handle realistic failure modes explicitly (bad input, empty/null values, I/O or network failure where relevant) — do not just cover the happy path.
5. Add comments only where the reasoning isn't obvious from the code itself.
6. Structure the code so it could be dropped into a real project (sensible file/module boundaries, no god functions).
7. If you rely on a third-party package, name it and its rough version compatibility.
8. Return only the code (plus the test section if requested below) — no surrounding commentary.
{tests_line}
"""

    result, elapsed = run_generation("Code Generator", prompt, request.model, request.temperature, request.max_tokens)

    return {"result": result, "seconds": elapsed}


@app.post("/api/code/debug")
def code_debug(request: DebugRequest):
    prompt = f"""
Debug the following {request.language} code with the rigor of a senior
engineer doing a real code review — do not invent bugs that aren't there,
and do not skip real ones.

Tasks
1. Find every real bug: logic errors, off-by-one errors, incorrect API
   usage, unhandled exceptions, race conditions, resource leaks, and
   security issues (injection, unsafe deserialization, etc. where relevant).
2. For each bug: state its severity (Critical / High / Medium / Low), the
   exact line or construct responsible, why it's wrong, and a concrete
   failure scenario (specific input or condition that triggers it).
3. Note any code smells or maintainability issues separately from actual
   bugs — don't conflate style preferences with defects.
4. Provide the fully corrected code, runnable end-to-end, not a diff.
5. If the code has no real bugs, say so plainly instead of manufacturing
   issues — but still suggest genuine quality improvements if any exist.

Return, in this order:
1. Bug List (severity-ranked)
2. Explanation (bug-by-bug, with the failure scenario for each)
3. Corrected Code

Code
{request.code}
"""

    result, elapsed = run_generation("Debugger", prompt, request.model, request.temperature, request.max_tokens)

    return {"result": result, "seconds": elapsed}


@app.post("/api/code/explain")
def code_explain(request: ExplainRequest):
    prompt = f"""
Explain this code for a {request.level} audience. Calibrate vocabulary and
depth to that level, but never sacrifice technical accuracy to simplify.

Include
1. Overview — what this code does and why it's structured this way, in
   plain language.
2. Step-by-step walkthrough of the logic in execution order.
3. Variables, functions, and classes — purpose of each non-trivial one.
4. Time and space complexity (Big-O) for any non-trivial algorithm, with a
   one-line justification of the bound.
5. A concrete example: sample input and the resulting output/behavior.
6. Best practices followed, and any real risks or limitations worth
   knowing about (not a padded "possible improvements" list).

Code
{request.code}
"""

    result, elapsed = run_generation("Explainer", prompt, request.model, request.temperature, request.max_tokens)

    return {"result": result, "seconds": elapsed}


@app.post("/api/code/optimize")
def code_optimize(request: OptimizeRequest):
    prompt = f"""
Optimize the following code, prioritized specifically for: {", ".join(request.goals) or "overall quality"}.

Requirements
1. Identify the actual bottleneck or weakness first — name the specific
   construct (e.g. "O(n^2) nested loop", "repeated I/O in a loop", "unbounded
   memory growth") rather than making generic claims.
2. Preserve exact behavior — the optimized code must be a drop-in
   replacement with identical inputs/outputs, unless a genuine bug is being
   fixed along the way (call that out explicitly if so).
3. State the complexity or resource-usage change concretely (e.g. "O(n^2)
   to O(n log n)", "3 network calls to 1 batched call").
4. Don't trade one requested goal for another silently — if a performance
   win costs readability, say so.

Return
1. Optimized Code (complete, runnable)
2. What Changed and Why (bottleneck-by-bottleneck)
3. Before/After comparison (complexity or measurable resource usage)
4. Any remaining trade-offs or further opportunities not applied here

Code
{request.code}
"""

    result, elapsed = run_generation("Optimizer", prompt, request.model, request.temperature, request.max_tokens)

    return {"result": result, "seconds": elapsed}


@app.post("/api/code/review")
def code_review(request: CodeActionRequest):
    prompt = f"""
Perform a holistic code review of this {request.language} code, the way a
senior engineer would in a real pull request review — not just a bug hunt.

Cover:
1. Correctness — flag any actual bugs you spot, but this is secondary to the points below.
2. Readability — naming, structure, function/method size, whether intent is clear without extra comments.
3. Architecture fit — separation of concerns, coupling, whether abstractions pull their weight or over-engineer.
4. Error handling — is failure handled deliberately, or ignored/swallowed.
5. Test coverage gaps — what's hard to test as written, and what's untested that should be.
6. Idiom — does it follow {request.language} conventions or fight against them.

Return, in this order:
1. One-line verdict (e.g. "Solid, ship with minor fixes" / "Needs rework before merge").
2. Strengths (genuine ones — don't pad this section if there's little to say).
3. Issues, each tagged must-fix / should-fix / nice-to-have, with the exact
   location and a concrete example of the problem.
4. A suggested refactor (code snippet) for the single most important issue.

Code
{request.code}
"""

    result, elapsed = run_generation("Reviewer", prompt, request.model, request.temperature, request.max_tokens)

    return {"result": result, "seconds": elapsed}


@app.post("/api/code/security")
def code_security(request: CodeActionRequest):
    prompt = f"""
Perform a security audit of this {request.language} code. Focus only on
genuinely exploitable issues — this is a vulnerability scan, not a general
quality review.

Check for, where applicable to this language/context: injection (SQL,
command, template, LDAP), XSS, insecure deserialization, hardcoded
secrets/credentials, missing or weak input validation, broken
authentication/authorization logic, insecure direct object references,
SSRF, path traversal, unsafe eval/exec/reflection, information disclosure
through error messages, and use of deprecated or weak cryptography/
randomness.

For each real finding:
1. Severity — Critical / High / Medium / Low (OWASP-aligned reasoning).
2. Exact location in the code.
3. Concrete attack scenario — a specific input or condition that exploits it.
4. The fix.

If there are no real vulnerabilities, say so plainly — do not manufacture
findings to pad the report.

Return: Summary (counts by severity), Findings (detailed), then the
hardened code if any changes are needed.

Code
{request.code}
"""

    result, elapsed = run_generation("Security Scanner", prompt, request.model, request.temperature, request.max_tokens)

    return {"result": result, "seconds": elapsed}


@app.post("/api/code/document")
def code_document(request: CodeActionRequest):
    prompt = f"""
Generate documentation for this exact {request.language} code — docstrings/
doc-comments in the idiomatic format for the language, plus a short summary.

For each public function/method/class:
1. Purpose — one or two sentences.
2. Parameters — name, type, meaning, whether optional.
3. Return value — type and meaning.
4. Exceptions/errors it can raise, and when.
5. A minimal usage example where it isn't obvious.

Insert the documentation directly into the code (as docstrings/doc-comments
in the language's standard style) and return the fully documented code —
not documentation as separate prose only.

Code
{request.code}
"""

    result, elapsed = run_generation("Documentation", prompt, request.model, request.temperature, request.max_tokens)

    return {"result": result, "seconds": elapsed}


@app.post("/api/code/commit")
def code_commit(request: CommitRequest):
    prompt = f"""
Write a git commit message for this change, following the Conventional
Commits specification: type(scope): short summary, blank line, body
explaining what changed and why, footer for breaking changes or issue
references if applicable.

Pick the correct type (feat, fix, refactor, docs, test, chore, perf, style)
based on what the change actually does — don't default to "feat" for a fix
or refactor.

Requirements:
1. Summary line imperative mood, under 72 characters.
2. Body explains the *why*, not a restatement of the diff.
3. If the change bundles multiple unrelated concerns, note that they should
   probably be split into separate commits — but still produce one message
   for what was given.
4. Also produce a short PR title and a 2-4 bullet PR description suitable
   for reviewers.

Change (diff or description)
{request.diff}
"""

    result, elapsed = run_generation("Commit Generator", prompt, request.model, request.temperature, request.max_tokens)

    return {"result": result, "seconds": elapsed}


# =====================================================
# PROJECT BUILDER
# =====================================================

@app.post("/api/project/generate")
def project_generate(request: ProjectRequest):
    prompt = f"""
Generate a complete, runnable software project — not a plan or a summary.

Project Name:
{request.name}

Language:
{request.language}

Framework:
{request.framework or "Choose the most idiomatic minimal option for this description, or none if not needed."}

Description:
{request.description}

Requirements:
1. Show the full folder/file structure as a tree.
2. For every file in that tree, provide its complete real contents — not
   descriptions of what the file would contain. Immediately before each
   file's code fence, put a line in EXACTLY this format, nothing else on
   that line: `FILE: path/to/file.ext` (relative path, forward slashes,
   no leading slash, no bold/backticks around it beyond what's shown).
   Then the code fence with the language tag. One FILE marker + one fence
   per file, every file in the tree.
3. Include the dependency manifest (requirements.txt / package.json /
   pom.xml / go.mod, whichever fits the language) as its own FILE block
   with real, current package names.
4. Include exact setup and run commands (install deps, environment
   variables needed, how to start it, how to run tests if any).
5. Wire the pieces together correctly — imports, routes, config must be
   internally consistent across files, not just individually plausible.
6. Keep scope proportional to the description — don't pad with unrequested
   features, but don't skip anything the description implies is needed
   (e.g. persistence, auth, error handling) for it to actually work.
7. Include a README.md as its own FILE block (overview + setup + run
   instructions) — this is in addition to, not instead of, the other files.
"""

    result, elapsed = run_generation("Project Builder", prompt, request.model, request.temperature, request.max_tokens)

    return {"result": result, "seconds": elapsed}


@app.post("/api/project/sql")
def project_sql(request: SQLRequest):
    prompt = f"""
Design a SQL schema for {request.dialect}, targeting this requirement:

{request.description}

Requirements:
1. Use {request.dialect}-specific syntax and types correctly (e.g. SERIAL/
   IDENTITY, JSONB vs JSON, appropriate date/time types) — do not write
   generic SQL that silently doesn't run on this dialect.
2. Normalize to at least 3NF by default; if you intentionally denormalize
   anything for performance, say so and why.
3. Every table: explicit primary key, appropriate foreign keys with ON
   DELETE/ON UPDATE behavior chosen deliberately (not left to default),
   NOT NULL / UNIQUE / CHECK constraints where the domain implies them.
4. Add indexes for foreign keys and any column implied to be
   filtered/sorted/joined on frequently — and briefly justify each one.
5. Use consistent, conventional naming (snake_case tables/columns,
   singular or plural — pick one convention and stay consistent).
6. Provide realistic sample INSERT data (3-5 rows per table) that respects
   all constraints and foreign key relationships.
7. Output valid, complete, executable SQL — no pseudocode.
"""

    result, elapsed = run_generation("SQL Generator", prompt, request.model, request.temperature, request.max_tokens)

    return {"result": result, "seconds": elapsed}


@app.post("/api/project/readme")
def project_readme(request: ReadmeRequest):
    prompt = f"""
Generate a professional, complete README.md for this project:

{request.details}

Structure it with (only include sections that genuinely apply):
1. Project title and a one-paragraph description of what it does and who
   it's for.
2. Features (concrete, not marketing fluff).
3. Prerequisites and installation steps that are actually runnable in
   order — real commands, not "install dependencies".
4. Usage — a minimal working example.
5. Configuration (environment variables / config files) if implied by the
   details given.
6. Project structure if a structure was given or implied.
7. License section (use a sensible placeholder if not specified).

Do not invent specific version numbers, URLs, or dependencies that weren't
given or clearly implied — use clearly-marked placeholders instead.
"""

    result, elapsed = run_generation("README Generator", prompt, request.model, request.temperature, request.max_tokens)

    return {"result": result, "seconds": elapsed}


@app.post("/api/project/docs")
def project_docs(request: DocsRequest):
    prompt = f"""
Generate professional software documentation for:

{request.details}

For each function/class/endpoint being documented, include:
1. Purpose — one or two sentences.
2. Parameters/arguments — name, type, whether required, meaning.
3. Return value — type and meaning.
4. Exceptions/errors it can raise or statuses it can return, and when.
5. A minimal usage example.
6. Edge cases or preconditions the caller needs to know about.

Use clear headings and consistent formatting throughout. Do not document
behavior that wasn't described or shown — flag any part of the request
that's too vague to document precisely instead of inventing detail.
"""

    result, elapsed = run_generation("Documentation Generator", prompt, request.model, request.temperature, request.max_tokens)

    return {"result": result, "seconds": elapsed}


@app.post("/api/project/tests")
def project_tests(request: TestsRequest):
    prompt = f"""
Generate a complete unit test suite for the following {request.language} code,
using the standard/most idiomatic testing framework for {request.language}
(e.g. pytest for Python, JUnit 5 for Java, Jest for JavaScript/TypeScript,
Google Test for C++).

Requirements:
1. Cover the happy path for every public function/method.
2. Cover realistic edge cases: empty/null input, boundary values, invalid
   types, and any error conditions the code can raise.
3. Mock or stub external dependencies (network, filesystem, database, time)
   rather than hitting them for real.
4. Use descriptive test names that state the scenario and expected outcome.
5. Assert actual behavior, not just "it doesn't throw" — check real return
   values and side effects.
6. Output complete, runnable test code with necessary imports/setup — not
   fragments.

Code
{request.code}
"""

    result, elapsed = run_generation("Unit Test Generator", prompt, request.model, request.temperature, request.max_tokens)

    return {"result": result, "seconds": elapsed}


@app.post("/api/project/api")
def project_api(request: ApiGeneratorRequest):
    prompt = f"""
Design and implement a REST API for:

{request.description}

Language: {request.language}
Framework: {request.framework or "Choose the most idiomatic minimal option for this description."}

Requirements:
1. List every endpoint: HTTP method, path, purpose.
2. For each endpoint: request schema (path/query/body params with types and
   whether required), success response schema with status code, and
   realistic error responses with their status codes.
3. Provide complete, runnable implementation code — routes, handlers, and
   request/response validation models — not pseudocode.
4. Follow RESTful conventions (correct verbs/status codes, resource-based
   URLs) unless the description clearly implies a different style (GraphQL,
   RPC).
5. Include real input validation and error handling per endpoint, not just
   happy-path code.
6. State the authentication/authorization approach if the description
   implies protected resources; otherwise say explicitly that none is
   included and why that's acceptable for this scope.
7. Organize the implementation into real files. Immediately before each
   file's code fence, put a line in EXACTLY this format, nothing else on
   that line: `FILE: path/to/file.ext` (relative path, forward slashes, no
   leading slash). One FILE marker + one fence per file. Include a
   requirements/dependency manifest and a README.md as their own FILE
   blocks too.
"""

    result, elapsed = run_generation("API Generator", prompt, request.model, request.temperature, request.max_tokens)

    return {"result": result, "seconds": elapsed}


@app.post("/api/project/database")
def project_database(request: DatabaseDesignRequest):
    prompt = f"""
Design the logical/conceptual data model for:

{request.description}

This is a design document, not implementation SQL for one specific
database engine — focus on the model, not dialect syntax.

Requirements:
1. List each entity with its attributes and abstract data types (e.g.
   "string", "integer", "timestamp", "boolean" — not tied to one DBMS).
2. State every relationship between entities with its cardinality
   (one-to-one, one-to-many, many-to-many) and explain the reasoning.
3. Target 3NF normalization; if you deliberately denormalize anything,
   say so and justify it.
4. Render the model as a Mermaid `erDiagram` code block.
5. Call out any requirement that was ambiguous and what you assumed to
   resolve it.
"""

    result, elapsed = run_generation("Database Designer", prompt, request.model, request.temperature, request.max_tokens)

    return {"result": result, "seconds": elapsed}


@app.post("/api/project/architecture")
def project_architecture(request: ArchitectureRequest):
    prompt = f"""
Recommend a system architecture for:

{request.description}

Requirements:
1. List the major components/services and the responsibility of each.
2. Describe how components communicate (synchronous HTTP/REST, async
   messaging/queue, gRPC, etc.) and justify the choice for this case.
3. Suggest a concrete, current tech stack per component only where the
   description doesn't already specify one — briefly justify each choice.
4. Flag the real architectural risks or trade-offs (single points of
   failure, consistency vs. availability, scaling bottlenecks) and how to
   mitigate each.
5. Render the architecture as a Mermaid flowchart code block.
6. Keep the design proportional to the stated scale — do not propose
   microservices, message queues, or Kubernetes for a small single-purpose
   tool unless the description genuinely implies that scale.
"""

    result, elapsed = run_generation("Architecture", prompt, request.model, request.temperature, request.max_tokens)

    return {"result": result, "seconds": elapsed}


@app.post("/api/project/docker")
def project_docker(request: DockerRequest):
    prompt = f"""
Generate Docker configuration for:

{request.description}

Language: {request.language or "infer from the description"}
Framework: {request.framework or "infer from the description, or none"}

Requirements:
1. Provide a complete, production-appropriate Dockerfile: a specific base
   image tag (never "latest"), a multi-stage build if it meaningfully
   reduces final image size for this language, a non-root user, only the
   files actually needed copied in, and the correct run command.
2. List what belongs in .dockerignore.
3. Provide a docker-compose.yml only if the description implies multiple
   services (app + database + cache, etc.); otherwise state explicitly
   that compose isn't necessary here and skip it.
4. List required environment variables/secrets by name (not values) and
   how they should be supplied at runtime.
5. Keep the image minimal — no unnecessary packages.
"""

    result, elapsed = run_generation("Docker", prompt, request.model, request.temperature, request.max_tokens)

    return {"result": result, "seconds": elapsed}


FILE_BLOCK_RE = re.compile(r"FILE:\s*(\S+)\s*\n```[^\n]*\n(.*?)```", re.DOTALL)


@app.post("/api/project/zip")
def project_zip(request: ZipExportRequest):
    files = FILE_BLOCK_RE.findall(request.content)

    if not files:
        return JSONResponse(
            status_code=400,
            content={"error": "No FILE: blocks found in this result — try regenerating it."},
        )

    buffer = io.BytesIO()
    safe_name = re.sub(r"[^a-zA-Z0-9_.-]+", "_", request.project_name.strip()) or "project"

    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for path, content in files:
            path = path.strip().lstrip("/")
            if ".." in path.split("/"):
                continue
            zf.writestr(f"{safe_name}/{path}", content.strip("\n") + "\n")

    buffer.seek(0)

    return StreamingResponse(
        buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={safe_name}.zip"},
    )


# =====================================================
# FILE ANALYZER
# =====================================================

@app.post("/api/file/analyze")
async def file_analyze(
    action: str = Form(...),
    file: UploadFile = File(...),
):
    raw = await file.read()

    content, is_text = extract_text(file.filename, raw)

    if not is_text:
        return JSONResponse(
            status_code=400,
            content={"error": "Preview and analysis are only supported for text-based files."},
        )

    prompts = {
        "explain": f"""
Explain this file for an Intermediate-level audience.

Include: overview of its purpose, a step-by-step walkthrough of the logic,
the role of each significant function/class, time/space complexity for any
non-trivial algorithm, and any risks or limitations worth flagging.

File: {file.filename}

{content}
""",
        "debug": f"""
Review this file like a senior engineer doing a real code review.

Find every real bug — logic errors, unhandled exceptions, resource leaks,
security issues — each with its severity (Critical/High/Medium/Low), the
exact location, why it's wrong, and a concrete failure scenario. Then
provide the fully corrected file. If there are no real bugs, say so instead
of inventing issues, but still flag genuine quality concerns if any exist.

File: {file.filename}

{content}
""",
        "optimize": f"""
Optimize this file for performance, readability, and maintainability.

Name the actual bottlenecks/weaknesses concretely (not generic claims),
preserve existing behavior exactly, state the complexity or resource-usage
change, and provide the complete optimized file.

File: {file.filename}

{content}
""",
        "docs": f"""
Generate professional documentation for this file: purpose of the file as a
whole, and for each public function/class — parameters, return values,
exceptions, and a minimal usage example.

File: {file.filename}

{content}
""",
        "security": f"""
Perform a security audit of this file. Focus only on genuinely exploitable
issues: injection, XSS, insecure deserialization, hardcoded secrets,
missing/weak input validation, broken auth logic, insecure direct object
references, SSRF, path traversal, unsafe eval/exec, information disclosure,
and weak/deprecated cryptography — whichever apply to this file's language
and context.

For each real finding: severity (Critical/High/Medium/Low), exact location,
a concrete attack scenario, and the fix. If there are no real
vulnerabilities, say so plainly instead of manufacturing findings.

File: {file.filename}

{content}
""",
        "complexity": f"""
Analyze the complexity and maintainability of this file.

For each function/method: estimate its cyclomatic complexity, flag any that
are too complex (roughly >10) or too long, and name what's driving the
complexity (deep nesting, long parameter lists, sprawling conditionals,
mixed responsibilities).

Give an overall maintainability read for the file as a whole, then suggest
concrete refactors (extract method, guard clauses, split responsibilities)
for the worst offender, with a code snippet showing the refactor applied.

File: {file.filename}

{content}
""",
    }

    if action not in prompts:
        return JSONResponse(status_code=400, content={"error": "Unknown action."})

    result, elapsed = run_generation(f"File Analyzer ({action})", prompts[action], temperature=0.2, max_tokens=6144)

    return {"result": result, "seconds": elapsed, "content": content, "filename": file.filename}


# =====================================================
# HISTORY
# =====================================================

@app.get("/api/history")
def get_history():
    rows = db.get_history()

    return {
        "history": [
            {
                "id": row[0],
                "feature": row[1],
                "prompt": row[2],
                "response": row[3],
                "created_at": row[4],
            }
            for row in rows
        ]
    }


@app.delete("/api/history")
def clear_history():
    db.clear_history()

    return {"success": True}


@app.get("/api/history/export")
def export_history():
    rows = db.get_history()

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["id", "feature", "prompt", "response", "created_at"])
    writer.writerows(rows)

    buffer.seek(0)

    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=history.csv"},
    )


# =====================================================
# ANALYTICS
# =====================================================

@app.get("/api/analytics")
def get_analytics():
    rows = db.get_analytics()

    return {"analytics": [{"feature": row[0], "count": row[1]} for row in rows]}


@app.delete("/api/analytics")
def reset_analytics():
    db.clear_analytics()

    return {"success": True}


# =====================================================
# REPORT GENERATOR
# =====================================================

ACADEMIC_TEMPLATE = [
    "Cover Page", "Certificate", "Declaration", "Acknowledgement", "Abstract",
    "Table of Contents", "List of Figures", "List of Tables",
    "Chapter 1", "Chapter 2", "Chapter 3", "Chapter 4",
    "Conclusion", "References", "Appendix",
]

INDUSTRY_TEMPLATE = [
    "Cover Page", "Executive Summary", "Introduction", "Problem Statement",
    "Business Objectives", "Scope", "Methodology", "Implementation", "Results",
    "Challenges", "Future Scope", "Conclusion", "Appendix",
]

EDIT_INSTRUCTIONS = {
    "expand": "Expand this content with more depth and detail, roughly 40% longer, staying accurate and non-repetitive.",
    "shorten": "Shorten this content to roughly half its length, keeping the most important points.",
    "rewrite": "Rewrite this content with fresh phrasing, keeping the same meaning and structure.",
    "simplify": "Simplify this content for a general, non-expert audience, keeping it accurate.",
    "humanize": "Rewrite this content so it reads naturally and conversationally, like a thoughtful human wrote it — avoid stiff, formulaic AI phrasing.",
    "academic": "Rewrite this content in a formal academic tone suitable for a scholarly paper.",
    "professional": "Rewrite this content in a polished professional business tone.",
    "technical": "Rewrite this content in a precise technical tone for an expert technical audience.",
    "formal": "Rewrite this content in a formal, objective tone.",
    "summarize": "Summarize this content into a concise version covering only the key points.",
    "continue": "Continue writing from where this content leaves off, in the same tone and style, adding substantial new content.",
    "grammar": "Fix any grammar, spelling, and punctuation issues in this content without changing its meaning, structure, or tone.",
}


def parse_json_list(text):
    text = text.strip()

    try:
        data = json.loads(text)
        if isinstance(data, list):
            return [str(x).strip() for x in data if str(x).strip()]
    except (json.JSONDecodeError, TypeError):
        pass

    match = re.search(r"\[.*\]", text, re.DOTALL)
    if match:
        try:
            data = json.loads(match.group(0))
            if isinstance(data, list):
                return [str(x).strip() for x in data if str(x).strip()]
        except (json.JSONDecodeError, TypeError):
            pass

    cleaned = []
    for line in text.split("\n"):
        line = re.sub(r"^[\-\*\d.)]+\s*", "", line.strip()).strip(' "\'')
        if line:
            cleaned.append(line)
    return cleaned


def safe_filename(name):
    return re.sub(r"[^a-zA-Z0-9_.-]+", "_", name.strip()) or "report"


@app.post("/api/report/toc")
def report_toc(request: ReportTocRequest):
    template_ref = ACADEMIC_TEMPLATE if request.template == "academic" else INDUSTRY_TEMPLATE

    prompt = f"""
Generate a professional Table of Contents for a {request.report_type} on the
topic: "{request.topic}".

Use this template's structure as a starting reference point, but write
actual, topic-specific chapter names instead of generic placeholders —
e.g. adapt "Chapter 1" / "Implementation" into names that genuinely fit
this topic, the way a real {request.report_type} on this subject would be
organized.

Reference structure ({request.template}):
{template_ref}

Generate between 10 and 18 chapters, in a sensible order for this topic and
report type.

Return ONLY a JSON array of chapter title strings, in order — no markdown,
no code fence, no explanation. Example: ["Introduction", "Background", ...]
"""

    if request.model:
        groq_ai.set_model(request.model)

    raw = groq_ai.generate_response(prompt, SYSTEM_PROMPT, temperature=0.4, max_tokens=1024)
    chapters = parse_json_list(raw)

    now = datetime.now().strftime("%d-%m-%Y %H:%M:%S")
    db.save_history("Report Generator (TOC)", request.topic[:500], raw, now)
    db.save_analytics("Report Generator", 0, now)

    return {"chapters": chapters}


@app.post("/api/report/chapter")
def report_chapter(request: ReportChapterRequest):
    subsections_hint = (
        f"Structure this chapter using these subsections in order: {', '.join(request.subsections)}."
        if request.subsections
        else ""
    )

    context_hint = (
        f"""
Context already covered in previous chapters (for continuity — do NOT
repeat this material, build on it and avoid contradicting it):
{request.previous_context}
"""
        if request.previous_context
        else ""
    )

    prompt = f"""
Write the chapter "{request.chapter_title}" (chapter {request.chapter_number} of
{request.total_chapters}) for a {request.report_type} on the topic:
"{request.topic}".

{subsections_hint}
{context_hint}

Requirements:
1. Write in {request.language}, in a {request.style} writing style
   appropriate for a {request.report_type}.
2. Target approximately {request.word_target} words for this chapter.
3. Insert inline numbered citations like [{request.citation_start}],
   [{request.citation_start + 1}], etc. at claims that would need a source
   in a real {request.report_type}, in {request.citation_style} in-text
   style — start numbering at [{request.citation_start}] (this continues
   the running citation count from earlier chapters — do not restart at 1
   unless {request.citation_start} is 1) and increase sequentially through
   this chapter only.
4. Where a diagram would genuinely help (architecture, flow, sequence, ER,
   etc.), include ONE relevant Mermaid diagram in a ```mermaid fenced code
   block with a short caption before it.
5. Where a table would genuinely help (comparison, metrics, timeline,
   summary), include ONE relevant Markdown table.
6. Use Markdown ### headings for any subsections within the chapter.
7. Do not repeat the chapter title as a top-level heading — start directly
   with content.
8. Do not invent specific statistics, named studies, or named authors as if
   real unless they are genuinely well-established facts. This is an
   AI-assisted draft, not verified research — keep claims general enough to
   be defensible rather than fabricating false precision.
9. If context from previous chapters was provided above, connect to it
   naturally (e.g. a brief transition), but do not summarize or restate it.
"""

    result, elapsed = run_generation(
        "Report Generator (Chapter)", prompt, request.model, request.temperature, request.max_tokens,
    )

    return {"result": result, "seconds": elapsed}


@app.post("/api/report/edit")
def report_edit(request: ReportEditRequest):
    if request.instruction not in EDIT_INSTRUCTIONS:
        return JSONResponse(status_code=400, content={"error": "Unknown edit instruction."})

    prompt = f"""
{EDIT_INSTRUCTIONS[request.instruction]}

Preserve any Markdown formatting, citation markers like [1], diagrams, and
tables unless the instruction is to shorten/summarize, in which case keep
only the most important ones.

Content
{request.content}

Return only the edited content — no preamble, no explanation.
"""

    result, elapsed = run_generation(
        "Report Generator (Edit)", prompt, request.model, request.temperature, request.max_tokens,
    )

    return {"result": result, "seconds": elapsed}


@app.post("/api/report/references")
def report_references(request: ReportReferencesRequest):
    prompt = f"""
Generate a reference list in {request.citation_style} format for the
citation markers ([1], [2], [3], ...) used in the following report text.
Infer plausible, properly-formatted {request.citation_style} references
consistent with the report's topic and the claim each citation is attached
to.

Cover every citation number that actually appears in the text, in order,
with no gaps and no unused numbers.

Report text
{request.combined_text[:12000]}

Return only the numbered reference list, one reference per line, nothing
else.
"""

    result, elapsed = run_generation(
        "Report Generator (References)", prompt, request.model, request.temperature, request.max_tokens,
    )

    return {"result": result, "seconds": elapsed}


@app.post("/api/report/readability")
def report_readability(request: ReadabilityRequest):
    return analyze_readability(request.text)


@app.post("/api/report/export/markdown")
def report_export_markdown(request: ReportExportRequest):
    parts = [f"# {request.title}\n"]

    for chapter in request.chapters:
        parts.append(f"\n## {chapter.title}\n\n{chapter.content}\n")

    if request.references:
        parts.append(f"\n## References\n\n{request.references}\n")

    content = "\n".join(parts)

    return StreamingResponse(
        iter([content]),
        media_type="text/markdown",
        headers={"Content-Disposition": f"attachment; filename={safe_filename(request.title)}.md"},
    )


@app.post("/api/report/export/docx")
def report_export_docx(request: ReportExportRequest):
    buffer = build_docx(
        request.title,
        [{"title": c.title, "content": c.content} for c in request.chapters],
        request.references,
    )

    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f"attachment; filename={safe_filename(request.title)}.docx"},
    )


@app.post("/api/report/export/pdf")
def report_export_pdf(request: ReportExportRequest):
    buffer = build_pdf(
        request.title,
        [{"title": c.title, "content": c.content} for c in request.chapters],
        request.references,
    )

    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={safe_filename(request.title)}.pdf"},
    )


# =====================================================
# AI DETECTOR / DOCUMENT INTELLIGENCE
# =====================================================

def _log_detector(feature, text_sample, response_sample, elapsed):
    now = datetime.now().strftime("%d-%m-%Y %H:%M:%S")
    db.save_history(feature, text_sample[:500], response_sample[:2000], now)
    db.save_analytics(feature, elapsed, now)


@app.post("/api/detect/analyze/text")
def detect_analyze_text(request: DetectTextRequest):
    if not request.text.strip():
        return JSONResponse(status_code=400, content={"error": "No text provided."})

    start = time.time()
    analysis = analyze_document(request.text)
    elapsed = round(time.time() - start, 2)

    _log_detector("AI Detector (Analyze)", request.text, f"AI likelihood: {analysis['ai_likelihood']['estimated_ai_probability']}%", elapsed)

    db.save_detector_history("text-input", analysis, request.text[:500], json.dumps(analysis))

    return {"text": request.text, "analysis": analysis, "seconds": elapsed}


@app.post("/api/detect/analyze/file")
async def detect_analyze_file(file: UploadFile = File(...)):
    raw = await file.read()

    try:
        text = extract_document_text(file.filename, raw)
    except ExtractionError as error:
        return JSONResponse(status_code=400, content={"error": str(error)})

    if not text.strip():
        return JSONResponse(status_code=400, content={"error": "No extractable text found in this file."})

    start = time.time()
    analysis = analyze_document(text)
    elapsed = round(time.time() - start, 2)

    _log_detector("AI Detector (Analyze)", text, f"AI likelihood: {analysis['ai_likelihood']['estimated_ai_probability']}%", elapsed)

    db.save_detector_history(file.filename or "uploaded-file", analysis, text[:500], json.dumps(analysis))

    return {"filename": file.filename, "text": text, "analysis": analysis, "seconds": elapsed}


# =====================================================
# AI DETECTOR HISTORY
# =====================================================

@app.get("/api/detect/history")
def get_detector_history():
    rows = db.get_detector_history()
    return {"history": rows, "count": len(rows)}


@app.get("/api/detect/history/{entry_id}")
def get_detector_entry(entry_id: int):
    data = db.get_detector_entry(entry_id)
    if not data:
        raise HTTPException(status_code=404, detail="Entry not found")
    return {"id": entry_id, "analysis": json.loads(data)}


@app.delete("/api/detect/history/{entry_id}")
def delete_detector_entry(entry_id: int):
    db.delete_detector_entry(entry_id)
    return {"success": True}


@app.delete("/api/detect/history")
def clear_detector_history():
    db.clear_detector_history()
    return {"success": True}


@app.post("/api/detect/insights")
def detect_insights(request: DetectInsightsRequest):
    a = request.analysis
    sample = request.text[:6000]

    stylo = a.get('stylometry', {})
    prompt = f"""
You are producing the explainable-AI narrative section of a document
intelligence report. You are given REAL, already-computed statistics about
this document — do not invent different numbers, and do not restate a
different AI-probability figure than the one given. Your job is to explain
and interpret these numbers, review writing quality, and give
recommendations, grounded in the actual text sample provided.

Computed statistics (already calculated — treat as ground truth):
- Word count: {a['stats']['word_count']}
- Estimated AI-writing likelihood: {a['ai_likelihood']['estimated_ai_probability']}% ({a['ai_likelihood']['band']}), confidence: {a['ai_likelihood']['confidence']}
- Top contributing signals: {a['ai_likelihood']['contributing_factors'][:5]}

Stylometric signals:
- Burstiness (sentence-length CV): {stylo.get('burstiness_cv', 'N/A')} (low = uniform = more AI-like)
- Vocabulary richness (type-token ratio): {stylo.get('type_token_ratio', 'N/A')} (low = less diverse = more AI-like)
- Repetition ratio: {stylo.get('repetition_ratio', 'N/A')}
- Transition-phrase diversity: {stylo.get('transition_diversity', 'N/A')} (low = same transitions reused)
- Paragraph-length CV: {stylo.get('paragraph_length_cv', 'N/A')} (low = uniform paragraph sizes)
- Contraction ratio: {stylo.get('contraction_ratio', 'N/A')} (low = formal/AI-like, human writing uses more contractions)
- Hapax legomena ratio: {stylo.get('hapax_ratio', 'N/A')} (words used only once; low = predictable vocabulary)
- AI hedge-phrase density: {stylo.get('ai_phrase_density', 'N/A')} (high = more "it is important to note" patterns)
- Consecutive similar sentence lengths: {stylo.get('consecutive_similar_ratio', 'N/A')} (high = monotonous rhythm)
- Sentence opener diversity: {stylo.get('opener_diversity', 'N/A')} (low = repetitive sentence starts)
- Passive voice ratio: {stylo.get('passive_voice_ratio', 'N/A')}
- Filler word ratio: {stylo.get('filler_ratio', 'N/A')} (human writers use more fillers)

Readability:
- Flesch Reading Ease: {a['readability']['flesch_reading_ease']}
- Flesch-Kincaid Grade: {a['readability']['flesch_kincaid_grade']}
- Document structure score: {a['structure']['structure_score']}/100
- Writing mechanics score: {a['mechanics']['mechanics_score']}/100, issues: {a['mechanics']['issues']}
- Citations: {a['citations']['total_citations']} ({a['citations']['style_detected']}), density {a['citations']['citation_density_per_1000_words']}/1000 words

Text sample (first ~6000 characters of the document):
{sample}

Produce, using Markdown headings, in this order:

## Reasoning
Explain in plain language WHY the AI-likelihood estimate came out the way
it did, referencing the specific signals above. For each of the top 3-4
contributing factors, point to a concrete example in the text that
illustrates it. Then list 3-5 things in the text that would push the
estimate the OTHER direction — i.e. potential false-positive indicators.

## Human vs AI Writing Indicators
Two short lists: indicators found in THIS text that lean human, and
indicators that lean AI-generated. Only list things actually present.
For each indicator cite a brief quote or pattern from the text.

## Writing Quality Review
Grammar, clarity, tone consistency, and professionalism — concrete
observations with brief examples from the text, not generic advice.

## Tone Detected
State the dominant writing tone/register (e.g. Academic, Technical,
Business, Conversational, Formal) with a one-line justification.

## Recommendations
5-8 specific, actionable recommendations to improve this document. Each
recommendation must reference a specific passage or pattern and explain
what to change and why. Do not give generic advice like "vary your
sentence structure" without pointing to where exactly it needs variation.
"""

    result, elapsed = run_generation(
        "AI Detector (Insights)", prompt, request.model, request.temperature, request.max_tokens,
    )

    return {"result": result, "seconds": elapsed}


@app.post("/api/detect/humanize")
def detect_humanize(request: DetectHumanizeRequest):
    words = request.text.split()
    capped = len(words) > 1200
    working_text = " ".join(words[:1200]) if capped else request.text

    weakness_hint = (
        "Specifically address: " + "; ".join(request.weaknesses)
        if request.weaknesses
        else "Vary sentence length naturally, reduce repeated phrasing/transitions, and diversify vocabulary."
    )

    prompt = f"""
Rewrite the following text so it reads like natural, polished human writing
rather than uniform AI-generated prose. Preserve all meaning, facts,
citations, and structure.

{weakness_hint}

Specific techniques to apply:
1. SENTENCE RHYTHM: Alternate between short punchy sentences and longer
   compound ones. Break up sequences of 3+ sentences with similar length.
   Start some sentences with a dependent clause, others with a subject.
2. CONTRACTIONS: Use natural contractions where the tone allows
   (it's, don't, we've, that's) — formal AI text avoids them.
3. TRANSITIONS: Replace overused transitions ("Furthermore", "Moreover",
   "Additionally") with implicit logical flow, or varied connectors
   ("Still,", "That said,", "And yet,", "The catch is").
4. VOCABULARY: Swap generic formal words ("utilize" → "use", "leverage"
   → "take advantage of", "facilitate" → "help") and replace AI-hedging
   phrases ("it is important to note that" → cut or rephrase directly).
5. SPECIFICITY: Where the text uses vague intensifiers ("very important",
   "plays a crucial role"), make the claim concrete or drop the hedge.
6. OPENING VARIETY: Vary how sentences and paragraphs begin — not every
   paragraph should open with a topic sentence in the same pattern.
7. Keep every factual claim, citation marker [N], and heading intact —
   do not invent or remove information.
8. Return ONLY the rewritten text. No commentary, no "here is the
   rewritten version", no notes about changes.

Text:
{working_text}
"""

    result, elapsed = run_generation(
        "AI Detector (Humanize)", prompt, request.model, request.temperature, request.max_tokens,
    )

    if capped:
        result += "\n\n_[Note: only the first ~1,200 words were rewritten to keep this response focused — rewrite in sections for longer documents.]_"

    return {"result": result, "seconds": elapsed, "truncated": capped}


def _build_detector_report_body(analysis, insights):
    a = analysis
    ai = a["ai_likelihood"]
    lines = [
        "## Executive Summary",
        "",
        "| Metric | Value |",
        "|---|---|",
        f"| Word Count | {a['stats']['word_count']:,} |",
        f"| Reading Time | {a['stats']['reading_time_minutes']} minutes |",
        f"| Language | {a['stats']['language']} |",
        f"| Estimated AI-Writing Likelihood | {ai['estimated_ai_probability']}% ({ai['band']}) |",
        f"| Confidence | {ai['confidence']} |",
        f"| Document Structure Score | {a['structure']['structure_score']}/100 |",
        f"| Writing Mechanics Score | {a['mechanics']['mechanics_score']}/100 |",
        f"| Flesch Reading Ease | {a['readability']['flesch_reading_ease']} |",
        "",
        "## AI-Writing Likelihood Analysis",
        "",
        f"**Estimated AI Probability:** {ai['estimated_ai_probability']}% ({ai['band']})  ",
        f"**Human-Writing Complement:** {ai['human_probability_complement']}%  ",
        f"**Confidence:** {ai['confidence']}",
        "",
        ai["methodology"],
        "",
        "### Contributing Factors",
        "",
        "| Signal | Strength (0-1) | Weight |",
        "|---|---|---|",
    ]
    for f in ai["contributing_factors"]:
        lines.append(f"| {f['signal']} | {f['strength']} | {f['weight']} |")

    lines += [
        "",
        "## Readability",
        "",
        "| Index | Score |",
        "|---|---|",
        f"| Flesch Reading Ease | {a['readability']['flesch_reading_ease']} |",
        f"| Flesch-Kincaid Grade | {a['readability']['flesch_kincaid_grade']} |",
        f"| Gunning Fog Index | {a['readability']['gunning_fog_index']} |",
        f"| SMOG Index | {a['readability']['smog_index']} |",
        f"| Coleman-Liau Index | {a['readability']['coleman_liau_index']} |",
        f"| Automated Readability Index | {a['readability']['automated_readability_index']} |",
        f"| Avg Words / Sentence | {a['readability']['avg_words_per_sentence']} |",
        f"| Avg Syllables / Word | {a['readability']['avg_syllables_per_word']} |",
        "",
        "## Stylometric Analysis",
        "",
        "| Metric | Value |",
        "|---|---|",
        f"| Sentence Count | {a['stylometry']['sentence_count']} |",
        f"| Avg Sentence Length | {a['stylometry']['avg_sentence_length']} words |",
        f"| Sentence-Length Burstiness (CV) | {a['stylometry']['burstiness_cv']} |",
        f"| Paragraph Count | {a['stylometry']['paragraph_count']} |",
        f"| Avg Paragraph Length | {a['stylometry']['avg_paragraph_length']} words |",
        f"| Vocabulary Richness (TTR) | {a['stylometry']['type_token_ratio']} |",
        f"| Lexical Density | {a['stylometry']['lexical_density']} |",
        f"| Avg Word Length | {a['stylometry']['avg_word_length']} chars |",
        f"| Passive Voice Ratio | {a['stylometry']['passive_voice_ratio']} |",
        f"| Transition-Phrase Diversity | {a['stylometry']['transition_diversity']} |",
        f"| Repetition Ratio | {a['stylometry']['repetition_ratio']} |",
        "",
        "## Citation Analysis",
        "",
        "| Metric | Value |",
        "|---|---|",
        f"| Style Detected | {a['citations']['style_detected']} |",
        f"| Total Citations | {a['citations']['total_citations']} |",
        f"| Density (per 1,000 words) | {a['citations']['citation_density_per_1000_words']} |",
        f"| Numbering Gaps | {a['citations']['numbering_gaps'] or 'None'} |",
        "",
        "## Writing Mechanics",
        "",
        f"Score: {a['mechanics']['mechanics_score']}/100 — {a['mechanics']['total_issue_count']} issues detected "
        f"({a['mechanics']['issues_per_1000_words']} per 1,000 words).",
        "",
    ]
    for issue in a["mechanics"]["issues"]:
        lines.append(f"- **{issue['type']}** — {issue['count']} occurrence(s)" + (f" (e.g. \"{issue['example']}\")" if issue.get("example") else ""))

    if insights:
        lines += ["", "## AI-Generated Insights & Recommendations", "", insights]

    lines += [
        "",
        "## Disclaimer",
        "",
        "> This analysis estimates the likelihood of AI-assisted writing using "
        "statistical and linguistic signals. Results are probabilistic and "
        "should not be interpreted as conclusive proof of AI or human "
        "authorship. Writing mechanics and citation checks are automated and "
        "narrow in scope — they do not replace a full grammar/citation review.",
    ]

    return "\n".join(lines)


@app.post("/api/detect/export/markdown")
def detect_export_markdown(request: DetectExportRequest):
    body = _build_detector_report_body(request.analysis, request.insights)
    content = f"# Document Intelligence Report — {request.filename}\n\n{body}"

    return StreamingResponse(
        iter([content]),
        media_type="text/markdown",
        headers={"Content-Disposition": f"attachment; filename={safe_filename(request.filename)}.md"},
    )


@app.post("/api/detect/export/json")
def detect_export_json(request: DetectExportRequest):
    payload = {"filename": request.filename, "analysis": request.analysis, "insights": request.insights}
    content = json.dumps(payload, indent=2)

    return StreamingResponse(
        iter([content]),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename={safe_filename(request.filename)}.json"},
    )


@app.post("/api/detect/export/csv")
def detect_export_csv(request: DetectExportRequest):
    a = request.analysis
    rows = [
        ("word_count", a["stats"]["word_count"]),
        ("estimated_ai_probability", a["ai_likelihood"]["estimated_ai_probability"]),
        ("ai_band", a["ai_likelihood"]["band"]),
        ("confidence", a["ai_likelihood"]["confidence"]),
        ("structure_score", a["structure"]["structure_score"]),
        ("mechanics_score", a["mechanics"]["mechanics_score"]),
        ("flesch_reading_ease", a["readability"]["flesch_reading_ease"]),
        ("flesch_kincaid_grade", a["readability"]["flesch_kincaid_grade"]),
        ("gunning_fog_index", a["readability"]["gunning_fog_index"]),
        ("smog_index", a["readability"]["smog_index"]),
        ("coleman_liau_index", a["readability"]["coleman_liau_index"]),
        ("automated_readability_index", a["readability"]["automated_readability_index"]),
        ("burstiness_cv", a["stylometry"]["burstiness_cv"]),
        ("type_token_ratio", a["stylometry"]["type_token_ratio"]),
        ("repetition_ratio", a["stylometry"]["repetition_ratio"]),
        ("total_citations", a["citations"]["total_citations"]),
    ]

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["metric", "value"])
    writer.writerows(rows)

    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={safe_filename(request.filename)}.csv"},
    )


@app.post("/api/detect/export/docx")
def detect_export_docx(request: DetectExportRequest):
    body = _build_detector_report_body(request.analysis, request.insights)
    buffer = build_docx(f"Document Intelligence Report — {request.filename}", [{"title": "", "content": body}], "")

    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f"attachment; filename={safe_filename(request.filename)}.docx"},
    )


@app.post("/api/detect/export/pdf")
def detect_export_pdf(request: DetectExportRequest):
    body = _build_detector_report_body(request.analysis, request.insights)
    buffer = build_pdf(f"Document Intelligence Report — {request.filename}", [{"title": "", "content": body}], "")

    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={safe_filename(request.filename)}.pdf"},
    )


# =====================================================
# STATIC FRONTEND (mounted last so /api routes win)
# =====================================================

import os

_REACT_DIR = os.path.join(os.path.dirname(__file__), "static-react")
_LEGACY_DIR = os.path.join(os.path.dirname(__file__), "static")

if os.path.isdir(_REACT_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(_REACT_DIR, "assets")), name="assets")

    @app.get("/{path:path}")
    def spa_fallback(path: str):
        file = os.path.join(_REACT_DIR, path)
        if path and os.path.isfile(file):
            return FileResponse(file)
        return FileResponse(os.path.join(_REACT_DIR, "index.html"))
else:
    app.mount("/assets", StaticFiles(directory=os.path.join(_LEGACY_DIR, "assets")), name="assets")

    @app.get("/")
    def index():
        return FileResponse(os.path.join(_LEGACY_DIR, "index.html"))
