<!-- scripts/room.js -->
<script>
// Route ?man=... to correct portrait + room background
(() => {
  // Match EXACT filenames from your repo (per your screenshots)
  const MEN = {
    blade:     { name: 'Blade',
                 portrait: 'images/characters/blade/blade-chat.webp',
                 roomBg:   'images/characters/blade/blade-woods.jpg' },

    alexander: { name: 'Alexander',
                 portrait: 'images/characters/alexander/alexander-chat.webp',
                 roomBg:   'images/characters/alexander/alexander-boardroom.jpg' },

    grayson:   { name: 'Grayson',
                 portrait: 'images/characters/grayson/grayson-chat.webp',
                 roomBg:   'images/characters/grayson/grayson-bg.jpg' },

    dylan:     { name: 'Dylan',
                 portrait: 'images/characters/dylan/dylan-chat.webp',
                 roomBg:   'images/characters/dylan/dylan-garage.jpg' },

    silas:     { name: 'Silas',
                 portrait: 'images/characters/silas/silas-chat.webp',
                 roomBg:   'images/characters/silas/silas-stage.jpg' },

    viper:     { name: 'Viper',
                 portrait: 'images/characters/viper/viper-chat.webp',
                 roomBg:   'images/characters/viper/viper-bg.jpg' }
  };

  // Read ?man= param and sanitize
  const q = new URLSearchParams(location.search);
  const raw = (q.get('man') || '').toLowerCase().trim();
  const key = MEN[raw] ? raw : 'blade';  // safe default

  // Ensure proper scoping for CSS
  document.body.classList.add('chat');

  // Expose the room background to CSS
  document.body.style.setProperty('--room-bg', `url('${MEN[key].roomBg}')`);

  // Optional: wire portrait + name if these elements exist
  const $img  = document.querySelector('#portrait'); // <img id="portrait">
  const $name = document.querySelector('#roomName'); // <h1 id="roomName">
  if ($img)  $img.src = MEN[key].portrait;
  if ($name) $name.textContent = MEN[key].name;
})();
</script>
