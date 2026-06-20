# Sentinel - MVP scaffold
Projet MVP pour générer vidéos d'histoires cartoon 3D (TikTok portrait) en français.

Contenu :
- backend/ (Express API)
- worker/ (renderer + orchestration)
- renderer/ (Three.js scene HTML)
- public/ (UI minimale)
- .env.example, README et scripts

Prérequis :
- Node 18+
- npm ou yarn
- ffmpeg installé (accessible en PATH)
- Chromium (Puppeteer télécharge automatiquement une version si vous installez puppeteer)
- (Optionnel mais recommandé) Google Cloud service account JSON si vous utilisez Google TTS
- (Optionnel) Coqui TTS pour fallback local (installation Python)

Variables d'environnement (voir .env.example) :
- MISTRAL_API_KEY: votre clé Mistral
- MISTRAL_API_URL: endpoint API Mistral (ex: https://api.mistral.ai/v1/...)
- GOOGLE_APPLICATION_CREDENTIALS: chemin vers JSON (optionnel)
- PORT: 3000 par défaut
- VIDEO_WIDTH=1080
- VIDEO_HEIGHT=1920
- DEFAULT_DURATION=60

Notes importantes :
- J’ai implémenté un appel générique à l’API Mistral. Vérifiez MISTRAL_API_URL selon la doc officielle de Mistral et adaptez la payload si nécessaire.
- Par défaut la pipeline utilise Coqui TTS si Google TTS non configuré : cela permet un usage entièrement gratuit pour tests.
- Le rendu 3D est un template Three.js simple ; personnalisez scene.html pour ajouter assets glTF cartoon.
- Labial sync basique : animation bouche pilotée par l’amplitude audio (simplifiée). Pour sync phonème, ajouter outil d’alignement (ex: Gentle).

Commandes rapides :
1) Initialisation :
   cd Sentinel
   npm install

2) Lancer en dev :
   npm run dev
   -> ouvre API sur http://localhost:3000 et UI sur http://localhost:3000

3) Exemple d’utilisation via UI :
   - Ouvrez http://localhost:3000
   - Saisissez un thème et cliquez "Générer", puis "Render".

4) Fichiers générés :
   - données et vidéos sont enregistrées dans ./data/

Voir la section "Run" plus bas pour plus de détails.
