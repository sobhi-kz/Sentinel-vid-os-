Notes d'exécution du worker:
- Pour lancer manuellement le worker (qui écoute les jobs en mémoire) : npm run worker
  (Actuellement enqueueJob dans le server déclenche le rendu automatiquement).
- Pour tester le renderer seul : npm run render-test
- Assurez-vous que ffmpeg est disponible (ffmpeg --version)
- Pour Coqui TTS : pip install TTS  (voir https://github.com/coqui-ai/TTS)
