"""
safety.py
PURPOSE: Rule-based safety check that runs BEFORE any AI call. Dangerous topics get a fixed safe reply.
DEPENDS ON: nothing
USED BY: routers/chat.py
"""
from typing import Optional

# Keywords per category (English, Urdu, Sindhi). Matched as lowercase substrings.
KEYWORDS = {
    "emergency": [
        "chest pain", "can't breathe", "cannot breathe", "overdose", "took too many", "poison",
        "unconscious", "suicid", "severe allergic",
        "سینے میں درد", "سانس", "زیادہ گولیاں", "بے ہوش", "ٻيو ساهه", "ساهه نٿو", "سيني ۾ درد", "بي هوش",
    ],
    "change_dose": [
        "stop taking", "stop my", "change my dose", "increase my dose", "reduce my dose",
        "change prescription", "skip my medicine",
        "دوا بند", "خوراک بدل", "مقدار بدل", "دوا ڇڏي", "دوا بند ڪر", "مقدار بدلائي",
    ],
    "missed_dose": [
        "double dose", "double the dose", "extra dose", "missed a dose", "missed my dose", "forgot my", "catch up",
        "دگنی", "ڈبل", "خوراک بھول", "خوراک چھوٹ", "ٻيڻي", "خوراڪ وسري", "دوا وسري",
    ],
}

REPLIES = {
    "emergency": {
        "en": "This may be an emergency. Please call your local emergency number or go to the nearest hospital right now. I cannot help with emergencies.",
        "ur": "یہ ہنگامی صورتحال ہو سکتی ہے۔ براہ کرم فوراً اپنے مقامی ایمرجنسی نمبر پر کال کریں یا قریبی ہسپتال جائیں۔ میں ہنگامی حالات میں مدد نہیں کر سکتا۔",
        "sd": "هي ايمرجنسي ٿي سگهي ٿي. مهرباني ڪري هاڻي ئي پنهنجي مقامي ايمرجنسي نمبر تي ڪال ڪريو يا ويجهي اسپتال وڃو. مان ايمرجنسي ۾ مدد نٿو ڪري سگهان.",
    },
    "change_dose": {
        "en": "I cannot change or stop a prescription. Please do not change your dose on your own. Speak to your doctor or pharmacist first.",
        "ur": "میں نسخہ تبدیل یا بند نہیں کر سکتا۔ براہ کرم خود سے خوراک نہ بدلیں۔ پہلے اپنے ڈاکٹر یا فارماسسٹ سے بات کریں۔",
        "sd": "مان نسخو تبديل يا بند نٿو ڪري سگهان. مهرباني ڪري پاڻ مقدار نه بدلايو. پهرين پنهنجي ڊاڪٽر يا فارماسسٽ سان ڳالهايو.",
    },
    "missed_dose": {
        "en": "Please do not double a dose to catch up. The right action depends on the medicine, so check the leaflet or ask your pharmacist or doctor. You can mark the dose as missed in the app.",
        "ur": "براہ کرم چھوٹی ہوئی خوراک پوری کرنے کے لیے دگنی خوراک نہ لیں۔ صحیح طریقہ دوا پر منحصر ہے، اس لیے دوا کا پرچہ دیکھیں یا فارماسسٹ یا ڈاکٹر سے پوچھیں۔ آپ ایپ میں خوراک کو چھوٹی ہوئی نشان زد کر سکتے ہیں۔",
        "sd": "مهرباني ڪري وسريل مقدار پوري ڪرڻ لاءِ ٻيڻي مقدار نه کائو. صحيح طريقو دوا تي منحصر آهي، تنهنڪري دوا جو پرچو ڏسو يا فارماسسٽ يا ڊاڪٽر کان پڇو. توهان ايپ ۾ مقدار کي رهجي ويل نشان ڪري سگهو ٿا.",
    },
}


def check_message(text: str, language: str) -> Optional[str]:
    """Returns a fixed safe reply if the message touches a dangerous topic, otherwise None.
    Order matters: emergency is checked first."""
    lowered = text.lower()
    for category in ("emergency", "change_dose", "missed_dose"):
        if any(word in lowered for word in KEYWORDS[category]):
            return REPLIES[category].get(language, REPLIES[category]["en"])
    return None