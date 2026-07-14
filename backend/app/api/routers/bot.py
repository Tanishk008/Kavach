"""Kavach Bot router for intent matching and feature routing."""

import logging
import json
from typing import List, Optional
from fastapi import APIRouter
from pydantic import BaseModel

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(prefix="/api/bot", tags=["bot"])

class BotAction(BaseModel):
    label: str
    route: str

class BotChatRequest(BaseModel):
    message: str

class BotChatResponse(BaseModel):
    response: str
    actions: List[BotAction]

@router.post("/chat", response_model=BotChatResponse)
async def chat(request: BotChatRequest) -> BotChatResponse:
    """Analyze a user's message and suggest relevant Kavach features."""
    
    # 0. Try Groq LLM if API key is present
    if settings.groq_api_key:
        try:
            import groq
            client = groq.AsyncGroq(api_key=settings.groq_api_key)
            system_prompt = """You are Kavach Bot, a highly intelligent, empathetic, and professional AI cybersecurity assistant inside the Kavach app. 
Your goal is to help users protect themselves from digital fraud, scams, and cyber threats in India. 
Always reply conversationally in 1-2 sentences. 
You must output a raw JSON object with NO markdown formatting, NO backticks, and NO extra text outside the JSON.
The JSON must have this exact structure:
{
  "response": "Your conversational reply here",
  "actions": [
    {"label": "Button Text", "route": "/route-path"}
  ]
}

Available routes you can suggest (only suggest if highly relevant):
- /check-message (For scanning SMS, text, WhatsApp, voice notes, audio deepfakes)
- /check-number (For checking phone numbers and callers)
- /check-upi (For checking UPI IDs)
- /check-pay (For checking bank accounts / general fraud directory)
- /check-currency (For scanning currency notes for fake currency)
- /risk-map (For viewing live scam hotspots across India)
- /report (For reporting a scam)
- /helpline (For the 1930 emergency helpline)

If the user is just saying hello or asking how you are, respond naturally and you may leave the actions array empty or suggest a general tool.
"""
            completion = await client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": request.message}
                ],
                temperature=0.6,
                response_format={"type": "json_object"},
            )
            
            response_text = completion.choices[0].message.content
            if response_text:
                data = json.loads(response_text)
                actions = [BotAction(**a) for a in data.get("actions", [])]
                return BotChatResponse(response=data.get("response", "I'm here to help!"), actions=actions)
        except Exception as e:
            logger.error(f"Groq LLM failed: {e}")
            # Fall through to keyword matching on error
            pass

    msg = request.message.lower().strip()
    
    # 1. Message & Voice Check
    if any(kw in msg for kw in ["message", "sms", "text", "whatsapp", "voice", "audio", "deepfake", "sound"]):
        return BotChatResponse(
            response="If you received a suspicious message or voice note, I can scan it for threats, scam links, or AI deepfakes.",
            actions=[BotAction(label="Check Message & Voice", route="/check-message")]
        )
        
    # 2. UPI / Fraud Directory Check
    if any(kw in msg for kw in ["upi", "bank", "account", "vpa", "pay", "money to", "transfer"]):
        return BotChatResponse(
            response="Before sending money, always check the UPI ID or account number against our fraud directory.",
            actions=[BotAction(label="Check UPI ID", route="/check-upi"), BotAction(label="Fraud Directory", route="/check-pay")]
        )
        
    # 3. Number Check
    if any(kw in msg for kw in ["number", "call", "phone", "contact", "caller"]):
        return BotChatResponse(
            response="I can check if a phone number is associated with a verified institution or reported by other users.",
            actions=[BotAction(label="Check a Number", route="/check-number")]
        )
        
    # 4. Currency Check
    if any(kw in msg for kw in ["currency", "note", "fake note", "cash", "rupee"]):
        return BotChatResponse(
            response="I can help you scan a currency note using your camera to check for security features and verify its authenticity.",
            actions=[BotAction(label="Check Currency Note", route="/check-currency")]
        )
        
    # 5. Risk Map
    if any(kw in msg for kw in ["map", "area", "hotspot", "city", "where", "location", "stats"]):
        return BotChatResponse(
            response="You can view live scam hotspots across India and cross-border fraud activity on our Risk Map.",
            actions=[BotAction(label="View Risk Map", route="/risk-map")]
        )
        
    # 6. Report Scam
    if any(kw in msg for kw in ["report", "scammed", "lost money", "complaint", "cybercrime"]):
        return BotChatResponse(
            response="If you've encountered a scam, you should report it immediately so others are warned and the authorities can act.",
            actions=[BotAction(label="Report a Scam", route="/report"), BotAction(label="Emergency Helpline", route="/helpline")]
        )
        
    # 7. Conversational / Small Talk
    msg_words = set(msg.replace("?", "").replace("!", "").replace(".", "").split())
    
    # Identity & Creator
    if any(kw in msg for kw in ["who are you", "what are you", "your name", "are you a bot", "are you human"]):
        return BotChatResponse(
            response="I'm Kavach Bot, your personal AI cybersecurity assistant! I'm not human, but I'm designed to help you detect fake messages, suspicious numbers, and counterfeit currency.",
            actions=[]
        )
    if any(kw in msg for kw in ["who made you", "who created you"]):
        return BotChatResponse(
            response="I was created by the Kavach development team to help protect users from digital fraud and scams.",
            actions=[]
        )
        
    # Wellbeing & Status
    if any(kw in msg for kw in ["how are you", "how do you do", "what's up", "whats up", "how is it going", "how's it going"]):
        return BotChatResponse(
            response="I'm doing great, thank you! I'm here 24/7 to help you stay safe from scams. How can I assist you today?",
            actions=[
                BotAction(label="Scan a Message", route="/check-message"),
                BotAction(label="Verify Currency", route="/check-currency")
            ]
        )
        
    # Gratitude
    if any(kw in msg for kw in ["thank", "thanks", "appreciate", "grateful"]):
        return BotChatResponse(
            response="You're very welcome! Stay safe, and let me know if you need anything else.",
            actions=[]
        )
        
    # Farewells
    if any(kw in msg for kw in ["bye", "goodbye", "see you", "cya", "night", "goodnight", "sweet dreams"]):
        return BotChatResponse(
            response="Goodbye! Stay safe out there. I'll be here if you need me.",
            actions=[]
        )
        
    # Affirmations & Agreement
    if any(kw in msg for kw in ["ok", "okay", "yes", "yeah", "yep", "sure", "great", "awesome", "nice", "cool", "perfect"]):
        return BotChatResponse(
            response="Awesome! Let me know if you want to scan a message, verify a number, or check anything else.",
            actions=[
                BotAction(label="Scan a Message", route="/check-message"),
                BotAction(label="Check a Number", route="/check-number")
            ]
        )
        
    # Negations
    if any(kw == msg.strip() for kw in ["no", "nope", "nah", "nothing"]):
        return BotChatResponse(
            response="No problem! I'll be right here if you change your mind or need to check something suspicious.",
            actions=[]
        )

    # Capabilities
    if any(kw in msg for kw in ["what can you do", "help me", "how does this work", "features"]):
        return BotChatResponse(
            response="I can help you protect yourself from fraud! I can scan text messages for phishing links, analyze voice notes for deepfakes, check suspicious phone numbers, verify UPI IDs, and even scan currency notes for authenticity.",
            actions=[
                BotAction(label="Scan Message/Voice", route="/check-message"),
                BotAction(label="Check a Number", route="/check-number"),
                BotAction(label="Verify Currency", route="/check-currency")
            ]
        )
        
    # Basic Greetings
    if any(kw in msg_words for kw in ["hi", "hello", "hey", "yo", "sup", "greetings"]) or any(kw in msg for kw in ["good morning", "good evening", "good afternoon", "morning", "evening", "afternoon"]):
        return BotChatResponse(
            response="Hi there! I am Kavach Bot. I can help you detect scams, verify numbers, check UPI IDs, or scan fake currency. What would you like to do?",
            actions=[
                BotAction(label="Scan a Message", route="/check-message"),
                BotAction(label="Check UPI ID", route="/check-upi"),
                BotAction(label="Verify Currency", route="/check-currency")
            ]
        )

    # Default fallback
    return BotChatResponse(
        response="I'm not quite sure what you mean. While I love a good chat, my main expertise is protecting you from fraud! You can try one of my cybersecurity tools below:",
        actions=[
            BotAction(label="Check Message/Voice", route="/check-message"),
            BotAction(label="Check UPI ID", route="/check-upi"),
            BotAction(label="Check a Number", route="/check-number")
        ]
    )
