# Access AI Demo Rehearsal

Three-minute run-through for demo day.

## 0:00-0:30 - The Problem

"One point three billion people live with some form of disability. Today, they juggle separate apps: one to see, one to hear, one to sign, one for captions, and one for text-to-speech. We built Access AI to be one app that does all three, runs on a single GPU, and costs nothing to operate."

## 0:30-1:15 - Screen Reader

Open the app, enter Demo Mode, and open Screen Reader. Point the webcam at a medicine box or printed page.

"I point the camera at this medicine label. In 1.5 seconds, Florence-2 describes the scene, RapidOCR extracts the dosage, and edge-tts speaks it aloud. No cloud. No API key. Works on a plane."

## 1:15-1:45 - Text to Speech

Open Text to Speech, choose a sample, and press Speak.

"For a blind student with a printed exam, they scan it, paste the text here, and hear it in a natural Indian English voice. If the internet drops, the browser voice takes over automatically. Never silent."

## 1:45-2:15 - Speech to Sign

Open Speech to Sign, tap the microphone orb, and say: "I need help."

"For Deaf users in hospitals, we translate critical phrases into Indian Sign Language. Faster-whisper transcribes it, our phrasebook matches it, and a recorded ISL clip plays with gloss captions. Not synthetic avatars - real signers."

The 12 clips are the remaining physical demo asset and should be present in `frontend/public/signs/` before this section is rehearsed live.

## 2:15-2:45 - The Engineering

"All inference runs locally on an RTX 4060. We measured it: 1.48 seconds per image query, flat memory over hours, bounded cache, and semaphore-gated inference. The auth system is real - SQLite, bcrypt, and JWT - but judges enter with one tap via guest demo mode. The UI is itself accessible: high contrast, scalable text, motion-safe animations, and keyboard navigation."

## 2:45-3:00 - The Ask

"Be My Eyes sees. Ava hears. Signapse signs. Access AI does all three, offline, for free. We are seeking mentorship to expand the sign phrasebook and ship to Indian disability NGOs. Thank you."

## Clip Checklist

- [ ] `help.mp4` - I need help
- [ ] `water.mp4` - I need water
- [ ] `hospital.mp4` - Where is the hospital
- [ ] `name.mp4` - My name is
- [ ] `thank_you.mp4` - Thank you
- [ ] `sorry.mp4` - I am sorry
- [ ] `yes.mp4` - Yes
- [ ] `no.mp4` - No
- [ ] `pain.mp4` - I have pain here
- [ ] `medicine.mp4` - I need medicine
- [ ] `call_family.mp4` - Call my family
- [ ] `not_understand.mp4` - I do not understand

Clip specification: MP4, 1280x720 landscape, 2-4 seconds, waist-up framing, plain wall, and good lighting.
