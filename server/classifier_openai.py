import os
import json
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# ─────────────────────────────────────────────────────────────────────────────
# CLASSIFY USER INPUT  (gpt-4o-mini — fast, cheap, structured JSON)
# ─────────────────────────────────────────────────────────────────────────────

_CLASSIFY_SYSTEM = """You are a structured data extraction system for hobby/context classification.

Return ONLY valid JSON with this exact schema:
{
  "Hobby": string,
  "Level": string | null,
  "Goals": array of strings | null,
  "Progress": integer | null
}

Rules:
- ALL values MUST be in Bulgarian language
- Extract the main hobby or subject area (noun form)
- Infer skill level if mentioned or implied: "начинаещ" | "средно" | "напреднал"
- Extract specific goals as an array of strings
- When creating new contexts set "Progress" to null
- If information is missing use null
- If no clear hobby can be identified return: {"ERROR": true}

Examples:
Input: "Искам да науча пиано като начинаещ, с фокус върху класическа музика"
Output: {"Hobby": "пиано", "Level": "начинаещ", "Goals": ["класическа музика", "ежедневни упражнения"], "Progress": null}

Input: "abc123"
Output: {"ERROR": true}
"""


def classify_user_input(user_input: str) -> dict:
    """
    Classify raw user input into a structured hobby context.
    Uses gpt-4o-mini — sufficient for extraction, low latency.
    """
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": _CLASSIFY_SYSTEM},
                {"role": "user", "content": user_input},
            ],
            temperature=0.2,
            response_format={"type": "json_object"},
        )
        result_text = response.choices[0].message.content.strip()
        parsed = json.loads(result_text)
        return parsed if isinstance(parsed, dict) else {"ERROR": True}
    except Exception as e:
        print("classify_user_input error:", e)
        return {"ERROR": True}


# ─────────────────────────────────────────────────────────────────────────────
# UPDATE USER PROGRESS  (gpt-4o-mini)
# ─────────────────────────────────────────────────────────────────────────────

_PROGRESS_SYSTEM = """You are a learning progress tracker.

Given the OLD classification and the user's NEW update text, return an updated
classification JSON with the same schema:
{
  "Hobby": string,
  "Level": string | null,
  "Goals": array of strings | null,
  "Progress": integer (0-100)
}

Rules:
- ALL values MUST be in Bulgarian
- Increment "Progress" sensibly based on what the user reports learning
- Never decrease progress
- If the update is too vague or short (< 20 chars) keep progress unchanged
- Never exceed 100
"""


def update_user_progress(new_input: str, old_classification: dict) -> dict:
    """
    Merge new user progress report into an existing classification.
    Uses gpt-4o-mini.
    """
    prompt = (
        f"Previous classification:\n{json.dumps(old_classification, ensure_ascii=False)}\n\n"
        f"User update: {new_input}"
    )
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": _PROGRESS_SYSTEM},
                {"role": "user", "content": prompt},
            ],
            temperature=0.2,
            response_format={"type": "json_object"},
        )
        result_text = response.choices[0].message.content.strip()
        parsed = json.loads(result_text)
        return parsed if isinstance(parsed, dict) else {"ERROR": True}
    except Exception as e:
        print("update_user_progress error:", e)
        return {"ERROR": True}


# ─────────────────────────────────────────────────────────────────────────────
# GENERATE LEARNING PLAN  (gpt-4o — best reasoning for rich structured output)
# ─────────────────────────────────────────────────────────────────────────────

_PLAN_SYSTEM = """You are an expert learning coach and curriculum designer.

Given a hobby, skill level, and goals, generate a detailed, structured, motivating
learning plan in Bulgarian with HYPER-SPECIFIC daily/weekly breakdowns.

Return ONLY valid JSON matching this schema exactly:

{
  "title": string,
  "description": string,
  "phases": [
    {
      "id": integer,
      "phase": string,           // e.g. "Фаза 1"
      "title": string,           // phase title
      "duration": string,        // e.g. "Седмици 1–2"
      "icon": string,            // single emoji
      "status": string,          // always "upcoming" — frontend sets current/completed
      "steps": [
        {
          "title": string,       // short step name
          "detail": string,      // 2-3 sentences
          "expandable": true,    // always set to true — frontend will request full details on click
          "day_by_day_preview": string   // SHORT teaser like "День 1-3: X, День 4-5: Y"
        }
      ]
    }
  ],
  "tips": [
    {
      "icon": string,            // single emoji
      "text": string             // practical tip in Bulgarian
    }
  ]
}

CRITICAL INSTRUCTIONS:
- ALL text values MUST be in Bulgarian
- Generate exactly 4 phases, each with exactly 4-5 steps (not just 3)
- Every step MUST have `expandable: true` and a SHORT `day_by_day_preview` (1 line max)
- The detail field is 2-3 sentences — the FULL breakdown comes when user clicks expand
- Be hyper-specific in day_by_day_preview:
  * For music: "День 1: До-мажор скала 10 мин, День 2-3: Heian Shodan 5x бавно"
  * For sports: "Понеделник: 20 бутания, 30 коремни, Сряда: спаринг 15 мин"
  * For coding: "День 1: async/await туториал, День 2-3: проект TODO app"
- First phase status is "current", all others "upcoming"
- Generate exactly 3 tips
"""


def generate_learning_plan(hobby: str, level: str | None, goals: list[str] | None) -> dict:
    """
    Generate a full structured learning plan for a context.
    Uses gpt-4o for highest quality reasoning and rich output.
    """
    prompt = (
        f"Хоби: {hobby}\n"
        f"Ниво: {level or 'не е посочено'}\n"
        f"Цели: {', '.join(goals) if goals else 'не са посочени'}"
    )
    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": _PLAN_SYSTEM},
                {"role": "user", "content": prompt},
            ],
            temperature=0.4,
            response_format={"type": "json_object"},
        )
        result_text = response.choices[0].message.content.strip()
        parsed = json.loads(result_text)
        return parsed if isinstance(parsed, dict) else {"ERROR": True}
    except Exception as e:
        print("generate_learning_plan error:", e)
        return {"ERROR": True}


# ─────────────────────────────────────────────────────────────────────────────
# EXPAND STEP DETAILS  (gpt-4o — on-demand detailed breakdown)
# ─────────────────────────────────────────────────────────────────────────────

_STEP_DETAILS_SYSTEM = """You are a detailed training planner.

The user has a step in their learning plan and wants the FULL day-by-day breakdown.

Return ONLY valid JSON:
{
  "detailed_schedule": string   // Full breakdown in Bulgarian, formatted with line breaks.
                                // Example:
                                // "День 1 (Понеделник):\\n- 09:00 Затопляне 10 мин\\n- 09:10 До-мажор скала 15x бавно\\n\\nДень 2 (Вторник):\\n- Почивка или лек преглед на нотите"
}

Rules:
- ALL text MUST be in Bulgarian
- Be hyper-specific: times, reps, durations, exact exercises/pieces/topics
- Use \\n for line breaks (double backslash n)
- Make it actionable — someone should be able to follow this verbatim
"""


def generate_step_details(
    hobby: str,
    level: str | None,
    phase_title: str,
    step_title: str,
    step_detail: str,
) -> dict:
    """
    Generate the full day-by-day breakdown for a single step when user clicks expand.
    Uses gpt-4o for detailed, hyper-specific scheduling.
    """
    prompt = (
        f"Хоби: {hobby}\n"
        f"Ниво: {level or 'не е посочено'}\n"
        f"Фаза: {phase_title}\n"
        f"Стъпка: {step_title}\n"
        f"Контекст: {step_detail}\n\n"
        "Генерирай пълен дневен разпис за тази стъпка."
    )
    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": _STEP_DETAILS_SYSTEM},
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
            response_format={"type": "json_object"},
        )
        result_text = response.choices[0].message.content.strip()
        parsed = json.loads(result_text)
        return parsed if isinstance(parsed, dict) else {"ERROR": True}
    except Exception as e:
        print("generate_step_details error:", e)
        return {"ERROR": True}


# ─────────────────────────────────────────────────────────────────────────────
# ANALYZE MEDIA PERFORMANCE  (gpt-4o — vision + deep reasoning)
# ─────────────────────────────────────────────────────────────────────────────

_ANALYSIS_SYSTEM = """You are an expert performance coach and AI vision analyst.

You will receive a single composite image split into two panels by an orange vertical divider:
- LEFT panel (labelled "УЧЕНИК"):  the student's photo, normalised for clarity
- RIGHT panel (labelled "РЕФЕРЕНЦИЯ"): the reference / ideal performance photo

Analyse the student's technique compared to the reference and return ONLY valid JSON:

{
  "overall_score": integer (0-100),
  "summary": string,                  // 2-3 sentence overall assessment in Bulgarian
  "feedback_items": [
    {
      "category": string,             // e.g. "Позиция на ръцете"
      "score": integer (0-100),
      "feedback": string,             // what you observe in the student panel
      "suggestion": string            // specific actionable improvement
    }
  ],
  "next_focus": string,               // single most important thing to work on next
  "progress_increment": integer       // suggested progress points to add (1-10)
}

Rules:
- ALL text values MUST be in Bulgarian
- Generate 3 to 5 feedback_items covering the most important visible aspects
- Be specific, constructive, and encouraging
- Base feedback strictly on what is visible in the image panels
- progress_increment: 1-3 minor improvement, 4-6 solid effort, 7-10 excellent match
"""


def analyze_media_performance(
    hobby: str,
    level: str | None,
    composite_b64: str,
) -> dict:
    """
    Analyse a side-by-side composite image (student | reference) with GPT-4o vision.

    The composite is produced by image_normalizer.make_comparison_image() which:
      - normalises both photos (CLAHE + denoise + unsharp)
      - stitches them with an orange divider and УЧЕНИК / РЕФЕРЕНЦИЯ labels
      - encodes the result as JPEG

    Uses gpt-4o — the only model with strong vision + structured JSON reasoning.
    """
    context_note = (
        f"Хоби: {hobby}, ниво: {level or 'не е посочено'}. "
        "Лявото изображение е студентът, дясното е референцията, "
        "разделени от оранжева вертикална линия."
    )
    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": _ANALYSIS_SYSTEM},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": context_note},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{composite_b64}",
                                "detail": "high",
                            },
                        },
                    ],
                },
            ],
            temperature=0.3,
            response_format={"type": "json_object"},
            max_tokens=1500,
        )
        result_text = response.choices[0].message.content.strip()
        parsed = json.loads(result_text)
        return parsed if isinstance(parsed, dict) else {"ERROR": True}
    except Exception as e:
        print("analyze_media_performance error:", e)
        return {"ERROR": True}