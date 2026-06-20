---
name: "Scaffold Sentinel MVP"
about: "Ajout du scaffold Sentinel: génération d'histoires via Mistral, TTS Google/Coqui, renderer Three.js + Puppeteer, assemblage FFmpeg"
---

Cette PR ajoute le scaffold initial de Sentinel (MVP) :

- backend/ : API Express pour générer des histoires, lancer render, status, et récupérer la vidéo.
- lib/ : intégration Mistral (parsing flexible) et wrapper TTS (Google avec timepoints + fallback Coqui).
- worker/ : worker local in-memory qui orchestre le rendu (Puppeteer + FFmpeg).
- renderer/ : template Three.js minimal utilisé pour captures headless.
- public/ : UI minimale pour tester la pipeline localement.
- scripts/ : utilitaire pour convertir timepoints -> .srt
- examples/ : prompts SSML et .srt d'exemple

Notes :
- Ne contient pas de secrets. Configurez les variables d'environnement localement ou via GitHub Secrets.
- Voir README.md pour instructions d'installation et d'utilisation.
