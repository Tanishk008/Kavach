"""Actionable playbooks (B.7) — pre-written, ordered steps per scam type.

Every Caution/High Risk verdict maps to one of these so the user always gets
"what to do next", not just "this is risky".
"""

PLAYBOOKS: dict[str, dict] = {
    "digital_arrest": {
        "id": "digital_arrest",
        "title": "Suspected digital arrest scam",
        "steps": [
            "Do not pay any money or share OTP, UPI PIN, or bank details.",
            "Real police, CBI, ED or Customs never arrest or demand payment over a video call.",
            "Hang up / leave the call. You are not under any real arrest.",
            "Call the cyber crime helpline 1930 and tell a family member now.",
            "Save screenshots and the number — you can file a report from here.",
        ],
    },
    "loan_fraud": {
        "id": "loan_fraud",
        "title": "Suspected fake loan / recovery scam",
        "steps": [
            "Do not pay any 'processing' or 'penalty' fee to release a loan.",
            "Uninstall the loan app; revoke its contacts and gallery permissions.",
            "Do not respond to threats about contacting your family.",
            "Report the number and app, and call 1930 if money was taken.",
        ],
    },
    "investment_fraud": {
        "id": "investment_fraud",
        "title": "Suspected investment / trading scam",
        "steps": [
            "Stop transferring money to any 'guaranteed high return' scheme.",
            "Verify the entity on the SEBI / RBI registered-intermediaries list.",
            "Do not act on tips from unknown WhatsApp/Telegram groups.",
            "Save the UPI/account details and report them here.",
        ],
    },
    "delivery_customs": {
        "id": "delivery_customs",
        "title": "Suspected fake delivery / customs scam",
        "steps": [
            "No courier or customs office collects fees over a phone call.",
            "Do not click payment links sent by SMS or WhatsApp.",
            "Contact the courier company through its official website only.",
            "Report the number here.",
        ],
    },
    "sextortion": {
        "id": "sextortion",
        "title": "Suspected sextortion",
        "steps": [
            "Do not pay. Paying almost always leads to more demands.",
            "Stop responding and do not delete the chat — it is evidence.",
            "Block the contact and report at 1930 / cybercrime.gov.in.",
            "Talk to someone you trust; you are not alone in this.",
        ],
    },
    "kyc_fraud": {
        "id": "kyc_fraud",
        "title": "Suspected KYC / bank-verification scam",
        "steps": [
            "Banks never ask you to 'update KYC' by clicking an SMS/WhatsApp link.",
            "Do not enter your card number, CVV, OTP, or net-banking password on any linked page.",
            "Visit your bank's official app or branch directly to check your KYC status.",
            "If you already entered details, call your bank's official helpline immediately to block the account.",
        ],
    },
    "bank_impersonation": {
        "id": "bank_impersonation",
        "title": "Suspected bank impersonation",
        "steps": [
            "Genuine bank service/transaction calls now come only from the 1600/1601 number series.",
            "Never share your card number, CVV, OTP, UPI PIN, or net-banking password over a call.",
            "Hang up and call the number printed on your card or official bank app instead.",
            "Report the number here and to your bank's fraud helpline.",
        ],
    },
    "utility_disconnection": {
        "id": "utility_disconnection",
        "title": "Suspected utility (electricity/gas) disconnection scam",
        "steps": [
            "Electricity/gas boards never disconnect service same-day over an SMS/call threat.",
            "Do not call back an unofficial personal mobile number in the message.",
            "Check your bill status only via the official utility website or app.",
            "Report the number and block the sender.",
        ],
    },
    "task_job": {
        "id": "task_job",
        "title": "Suspected task/job scam",
        "steps": [
            "Legitimate jobs do not require an upfront 'registration' or 'task unlock' payment.",
            "Promises of large guaranteed daily income for simple tasks are a classic scam pattern.",
            "Do not share bank/UPI details or make any payment to 'activate' earnings.",
            "Report the contact and warn others; do not forward the link.",
        ],
    },
    "lottery_fraud": {
        "id": "lottery_fraud",
        "title": "Suspected lottery / prize scam",
        "steps": [
            "You cannot win a lottery or contest you never entered.",
            "Never pay a 'processing', 'tax', or 'release' fee to claim a prize.",
            "Do not share bank details, OTP, or ID proof with the sender.",
            "Delete the message and report the number.",
        ],
    },
    "otp_theft": {
        "id": "otp_theft",
        "title": "Suspected OTP-theft attempt",
        "steps": [
            "Never share an OTP with anyone — banks, delivery agents, and support staff never need it from you.",
            "If you already shared an OTP, check your account and card statements immediately.",
            "Call your bank's official helpline to freeze the account/card if anything looks wrong.",
            "Report the number and call 1930 if money was moved.",
        ],
    },
    "violent_threat": {
        "id": "violent_threat",
        "title": "Immediate safety actions",
        "steps": [
            "Do not respond to the threat.",
            "Take a screenshot of the message for evidence — do not delete the chat.",
            "Contact local police or dial 112 immediately.",
            "Tell someone you trust right away; do not handle this alone.",
        ],
    },
    "generic": {
        "id": "generic",
        "title": "Stay cautious",
        "steps": [
            "Do not share OTP, PIN, passwords, or make any urgent payment.",
            "Verify the caller/sender through an official channel independently.",
            "When in doubt, call 1930 or ask a trusted person.",
        ],
    },
}


def get_playbook(scam_type: str | None) -> dict:
    """Return the playbook for a scam type, falling back to the generic one."""
    return PLAYBOOKS.get(scam_type or "", PLAYBOOKS["generic"])
