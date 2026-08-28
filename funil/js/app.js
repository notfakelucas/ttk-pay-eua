/* TikTok Rewards — vanilla JS */
/* PALINSKI FUNNEL EXACT V9 — persistent attribution + popup checkout bridge */
'use strict';

const CONFIG = {
  brandName: 'TikTok Rewards',
  logo: 'assets/tiktok-logo.png?v=8',

  sound: {
    enabled: true,
    rewardFile: 'assets/reward-popup.mp3?v=8'
  },

  finalUrl: 'https://www.checkout-ds24.com/product/711504',

  vsl: {
    playerId: 'vid-6a8299517597cbc70f8bc041',
    playerScript: 'https://scripts.converteai.net/7c7bd695-6caf-4018-a18e-698278a6e371/players/6a8299517597cbc70f8bc041/v4/player.js'
  },

  feed: [
    {
      username: '@olivia_smith',
      description: 'Watch, react, and keep going ✨',
      tags: '#fyp #viral #reaction',
      src: 'assets/video01.mp4?v=9',
      avatarSrc: 'assets/avatar01.jpeg?v=8',
      reward: 22,
      counts: ['23.6K','587','2.1K','742']
    },
    {
      username: '@jake_miller',
      description: 'One more reaction before the bonus round ⚡',
      tags: '#trending #foryou #reaction',
      src: 'assets/video02.mp4?v=8',
      avatarSrc: 'assets/avatar02.jpeg?v=8',
      reward: 21,
      counts: ['8.7K','215','934','381']
    }
  ],

  reactions: [
    {
      label: 'LIKE',
      tone: 'like',
      icon: 'i-thumbs-up',
      particles: ['👍','✨','👍','✦'],
      glow: 'rgba(37,244,238,.42)'
    },
    {
      label: 'DISLIKE',
      tone: 'dislike',
      icon: 'i-thumbs-down',
      particles: ['👎','✨','👎','✦'],
      glow: 'rgba(254,44,85,.42)'
    }
  ],

  wheel: [2,3,5,2,3,2,3,2]
};

const STORAGE_KEY = 'tiktok_rewards_state_v9';
const SOUND_KEY = 'tiktok_rewards_sound_v2';

const storage = {
  get(store, key) {
    try { return store.getItem(key); } catch (_) { return null; }
  },
  set(store, key, value) {
    try { store.setItem(key, value); } catch (_) {}
  },
  remove(store, key) {
    try { store.removeItem(key); } catch (_) {}
  }
};

function defaultState() {
  return {
    screen: 'invite',
    currentVideo: 0,
    reactions: [],
    rewardValues: [],
    score: 0,
    spinning: false,
    spinResult: null,
    spinAttempt: 0,
    spinDone: false,
    wheelRotation: 0,
    soundEnabled: storage.get(localStorage, SOUND_KEY) !== '0',
    videoSoundOn: false,
    vslUnlocked: false
  };
}

function formatMoney(value, { signed = false } = {}) {
  const number = Number(value) || 0;
  const sign = signed ? (number >= 0 ? '+' : '-') : (number < 0 ? '-' : '');
  return `${sign}$${Math.abs(number).toFixed(2)}`;
}

const SoundManager = {
  ctx: null,
  enabled: true,
  rewardAudio: null,
  rewardFileAvailable: false,

  init() {
    this.enabled = App.state.soundEnabled;

    try {
      this.rewardAudio = new Audio(CONFIG.sound.rewardFile);
      this.rewardAudio.preload = 'auto';
      this.rewardAudio.volume = .78;

      this.rewardAudio.addEventListener(
        'canplaythrough',
        () => { this.rewardFileAvailable = true; },
        { once: true }
      );

      this.rewardAudio.addEventListener(
        'error',
        () => { this.rewardFileAvailable = false; },
        { once: true }
      );

    } catch (_) {}
  },

  unlock() {
    if (!this.ctx) {
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      if (AudioContextCtor) this.ctx = new AudioContextCtor();
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    return !!this.ctx;
  },

  setEnabled(value) {
    this.enabled = !!value;
    App.state.soundEnabled = this.enabled;
    storage.set(localStorage, SOUND_KEY, this.enabled ? '1' : '0');
    App.saveState();
  },

  tone({
    frequency = 440,
    endFrequency = null,
    type = 'sine',
    gain = .05,
    start = 0,
    duration = .08
  }) {
    if (!this.enabled || !this.ctx) return;

    const t = this.ctx.currentTime + start;
    const oscillator = this.ctx.createOscillator();
    const amp = this.ctx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, t);

    if (endFrequency) {
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(30, endFrequency),
        t + duration
      );
    }

    amp.gain.setValueAtTime(.0001, t);
    amp.gain.exponentialRampToValueAtTime(
      gain,
      t + Math.min(.018, duration / 3)
    );
    amp.gain.exponentialRampToValueAtTime(.0001, t + duration);

    oscillator.connect(amp).connect(this.ctx.destination);
    oscillator.start(t);
    oscillator.stop(t + duration + .02);
  },

  playTap() {
    this.tone({
      frequency: 220,
      endFrequency: 180,
      type: 'triangle',
      gain: .022,
      duration: .045
    });
  },

  playReaction() {
    this.tone({
      frequency: 410,
      endFrequency: 560,
      type: 'sine',
      gain: .035,
      duration: .06
    });

    this.tone({
      frequency: 820,
      endFrequency: 960,
      type: 'triangle',
      gain: .018,
      start: .035,
      duration: .05
    });
  },

  playReward() {
    if (!this.enabled) return;

    if (this.rewardAudio) {
      try {
        this.rewardAudio.currentTime = 0;
        const playPromise = this.rewardAudio.play();

        if (playPromise && playPromise.catch) {
          playPromise.catch(() => this.playRewardSynth());
        }
        return;
      } catch (_) {}
    }

    this.playRewardSynth();
  },

  playRewardSynth() {
    this.tone({
      frequency: 880,
      endFrequency: 1320,
      type: 'sine',
      gain: .075,
      duration: .16
    });

    this.tone({
      frequency: 1174,
      endFrequency: 1760,
      type: 'sine',
      gain: .06,
      start: .11,
      duration: .18
    });

    this.tone({
      frequency: 2360,
      endFrequency: 3120,
      type: 'triangle',
      gain: .022,
      start: .20,
      duration: .22
    });
  },

  playJackpot() {
    this.tone({
      frequency: 620,
      endFrequency: 900,
      type: 'sine',
      gain: .055,
      duration: .12
    });

    this.tone({
      frequency: 820,
      endFrequency: 1200,
      type: 'sine',
      gain: .06,
      start: .10,
      duration: .14
    });

    this.tone({
      frequency: 1040,
      endFrequency: 1560,
      type: 'sine',
      gain: .055,
      start: .21,
      duration: .18
    });

    this.tone({
      frequency: 2080,
      endFrequency: 3200,
      type: 'triangle',
      gain: .025,
      start: .34,
      duration: .26
    });
  }
};

const App = {
  state: defaultState(),
  els: {},
  reactionLocked: false,
  animationToken: 0,
  tickRaf: 0,
  lastTickSector: null,
  wheelResultIndex: null,
  mediaWarmers: [],
  imageWarmers: [],
  vturbMounted: false,
  reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,

  initApp() {
    this.cacheElements();
    this.loadState();
    this.ensureRewardValues();
    this.applyDeepLink();

    // Capture/restore every external query parameter before any step begins.
    this.syncTrackingParamsToUrl();

    SoundManager.init();

    // Hardens the exact #pgv / #pgopen / #pgform / #pggo popup supplied
    // by the checkout CTA. It no longer depends only on location.search.
    this.installPopupParamBridge();

    this.buildReactionGrid();
    this.buildWheel();
    this.bindEvents();
    this.installAudioUnlock();
    this.warmFeedAssets();
    this.restoreUI();
    this.finishBoot();
    this.exposeDebug();
  },

  cacheElements() {
    const $ = selector => document.querySelector(selector);

    this.els = {
      header: $('#appHeader'),
      screens: [...document.querySelectorAll('.screen')],
      start: $('#startExperience'),

      wallet: $('#wallet'),
      balance: $('#balanceValue'),
      walletFloat: $('#walletFloat'),

      evaluationRewardCard: $('#evaluationRewardCard'),
      evaluationRewardAmount: $('#evaluationRewardAmount'),

      videoCard: $('#videoCard'),
      video: $('#feedVideo'),
      videoFallback: $('#videoFallback'),

      username: $('#videoUsername'),
      description: $('#videoDescription'),
      tags: $('#videoTags'),
      avatar: $('#profileAvatar'),

      likeCount: $('#likeCount'),
      commentCount: $('#commentCount'),
      saveCount: $('#saveCount'),
      shareCount: $('#shareCount'),
      shareBtn: $('#shareBtn'),

      reactionGrid: $('#reactionGrid'),

      rewardModal: $('#rewardModal'),
      modalAmount: $('#modalAmount'),
      confettiLayer: $('#confettiLayer'),

      wheelShell: $('#wheelShell'),
      wheelRotator: $('#wheelRotator'),
      wheelPointer: $('#wheelPointer'),

      spinButton: $('#spinButton'),
      spinResult: $('#spinResult'),
      spinResultTitle: $('#spinResultTitle'),
      spinResultText: $('#spinResultText'),
      continueToVsl: $('#continueToVsl'),
      vslWrapper: $('#vslWrapper'),

    };
  },

  loadState() {
    // Production flow always starts at the invite. A prior tab/session must
    // never reopen directly on Feed, Spin or VSL.
    this.state = defaultState();
    storage.remove(sessionStorage, STORAGE_KEY);

    const storedSound = storage.get(localStorage, SOUND_KEY);
    if (storedSound !== null) {
      this.state.soundEnabled = storedSound !== '0';
    }
  },

  ensureRewardValues() {
    const exactRewards = [25.26, 27.43];

    const valid =
      Array.isArray(this.state.rewardValues) &&
      this.state.rewardValues.length === exactRewards.length &&
      this.state.rewardValues.every(
        (value, index) => Math.abs(Number(value) - exactRewards[index]) < 0.001
      );

    if (valid) return;

    this.state.rewardValues = [...exactRewards];
    this.saveState();
  },

  getRewardForVideo(index = this.state.currentVideo) {
    const value = Number(this.state.rewardValues[index]);
    return Number.isFinite(value) ? value : 25.26;
  },

  saveState() {
    const safe = {
      ...this.state,
      spinning: false
    };

    storage.set(
      sessionStorage,
      STORAGE_KEY,
      JSON.stringify(safe)
    );
  },

  resetExperience() {
    storage.remove(sessionStorage, STORAGE_KEY);

    this.animationToken += 1;
    this.reactionLocked = false;
    cancelAnimationFrame(this.tickRaf);

    this.state = defaultState();
    this.ensureRewardValues();

    this.hideRewardModal(true);

    this.els.wheelRotator.style.transition = 'none';
    this.els.wheelRotator.style.transform = 'rotate(0deg)';

    this.restoreUI();
    this.showScreen('invite', { immediate: true });

    return 'TikTok Rewards reset';
  },

  applyDeepLink() {
    // `step` is debug/progression state, not attribution. Ignore and remove it.
    const url = new URL(location.href);
    if (url.searchParams.has('step')) {
      url.searchParams.delete('step');
      history.replaceState({}, '', url.toString());
    }

    this.state.screen = 'invite';
    this.state.currentVideo = 0;
    this.state.reactions = [];
    this.state.score = 0;
    this.state.spinAttempt = 0;
    this.state.spinDone = false;
    this.state.spinResult = null;
    this.state.wheelRotation = 0;
    this.state.vslUnlocked = false;
  },

  bindEvents() {
    this.els.start.addEventListener('click', () => this.startExperience());
    this.els.shareBtn.addEventListener('click', () => this.shareExperience());

    this.els.spinButton.addEventListener('click', () => this.spinWheel());
    this.els.continueToVsl.addEventListener('click', () => this.showVSL());
this.els.video.addEventListener(
      'loadeddata',
      () => {
        this.els.video.style.opacity = '1';
        this.els.videoFallback.hidden = true;
      }
    );

    this.els.video.addEventListener(
      'error',
      () => {
        this.els.video.style.opacity = '0';
        this.els.videoFallback.hidden = false;
      }
    );
  },

  installAudioUnlock() {
    const unlock = () => {
      this.unlockAudio();

      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('touchstart', unlock, true);
      window.removeEventListener('keydown', unlock, true);
    };

    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('touchstart', unlock, {
      capture: true,
      passive: true
    });
    window.addEventListener('keydown', unlock, true);
  },

  unlockAudio() {
    return SoundManager.unlock();
  },

  warmFeedAssets() {
    // Prime the exact feed media while the visitor is still on the invite.
    // This does not autoplay anything and does not touch VTurb.
    const first = CONFIG.feed[0];

    if (first && this.els.video) {
      this.els.video.preload = 'auto';
      this.els.video.muted = true;
      this.els.video.playsInline = true;

      if (this.els.video.getAttribute('src') !== first.src) {
        this.els.video.src = first.src;
      }

      try { this.els.video.load(); } catch (_) {}
    }

    CONFIG.feed.forEach((item, index) => {
      const image = new Image();
      image.decoding = 'async';
      image.src = item.avatarSrc;
      this.imageWarmers.push(image);
      image.decode?.().catch(() => {});

      if (index === 0) return;

      const video = document.createElement('video');
      video.preload = 'auto';
      video.muted = true;
      video.playsInline = true;
      video.src = item.src;
      video.setAttribute('aria-hidden', 'true');
      video.tabIndex = -1;
      video.style.cssText =
        'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-9999px;top:-9999px';

      document.body.appendChild(video);
      this.mediaWarmers.push(video);

      try { video.load(); } catch (_) {}
    });
  },

  async finishBoot() {
    const logo = document.querySelector('.brand-logo--header, .brand-logo--invite');

    try {
      if (logo && logo.decode) {
        await logo.decode();
      }
    } catch (_) {}

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.body.classList.add('is-ready');
      });
    });
  },

  restoreUI() {
    this.setBalance(this.state.score, false);

    this.showScreen(
      this.state.screen,
      {
        immediate: true,
        updateUrl: false
      }
    );

    if (this.state.screen === 'feed') {
      this.loadFeed(this.state.currentVideo, { immediate: true });
    }

    if (this.state.screen === 'spin') {
      this.restoreSpinState();
    }

  },

  showScreen(name, { immediate = false, updateUrl = true } = {}) {
    const target = this.els.screens.find(
      screen => screen.dataset.screen === name
    );

    if (!target) return;

    const current = this.els.screens.find(
      screen =>
        !screen.hidden &&
        screen.classList.contains('screen--active')
    );

    const activate = () => {
      if (name !== 'invite') {
        const headerHost =
          name === 'vsl'
            ? target.querySelector('.vsl-top-group')
            : target;

        if (
          headerHost &&
          this.els.header.parentElement !== headerHost
        ) {
          headerHost.prepend(this.els.header);
        }
      }

      this.els.screens.forEach(screen => {
        const active = screen === target;

        screen.hidden = !active;
        screen.classList.toggle('screen--active', active);
        screen.classList.remove('is-leaving');
      });

      this.state.screen = name;
      this.els.header.hidden = name === 'invite';
      document.body.classList.toggle('screen-invite', name === 'invite');
      document.body.dataset.activeScreen = name;
      this.saveState();

      if (updateUrl) {
        this.updateUrlStep(name);
      }

      // SPA steps never own attribution. Rehydrate any original params that
      // another script/history operation may have removed.
      this.syncTrackingParamsToUrl();

      if (name === 'feed') {
        this.loadFeed(this.state.currentVideo, { immediate: true });
      } else {
        // Never leave the short-form feed playing underneath Spin/VSL.
        try { this.els.video.pause(); } catch (_) {}
      }

      if (name === 'spin') {
        this.restoreSpinState();
      }

      if (name === 'vsl') {
        // The VTurb element and remote player script are created only now.
        this.mountVturb();
      }

      window.scrollTo({
        top: 0,
        behavior: this.reducedMotion ? 'auto' : 'smooth'
      });
    };

    if (
      immediate ||
      !current ||
      current === target ||
      this.reducedMotion
    ) {
      activate();
      return;
    }

    current.classList.add('is-leaving');
    window.setTimeout(activate, 165);
  },

  updateUrlStep(_step) {
    // Keep the public URL clean and keep campaign parameters untouched.
    const url = new URL(location.href);
    if (url.searchParams.has('step')) {
      url.searchParams.delete('step');
      history.replaceState({}, '', url.toString());
    }
  },

  startExperience() {
    this.unlockAudio();

    // A user gesture lets mobile browsers become more aggressive about media buffering.
    this.mediaWarmers.forEach(video => {
      try { video.load(); } catch (_) {}
    });

    this.state.currentVideo = Math.min(
      this.state.currentVideo,
      CONFIG.feed.length - 1
    );

    this.showScreen('feed');
  },

  buildReactionGrid() {
    this.els.reactionGrid.innerHTML = '';

    CONFIG.reactions.forEach((reaction, index) => {
      const button = document.createElement('button');

      button.type = 'button';
      button.className = 'reaction-btn';
      button.dataset.tone = reaction.tone;
      button.style.setProperty('--reaction-glow', reaction.glow);

      button.setAttribute(
        'aria-label',
        `React ${reaction.label}`
      );

      button.innerHTML = `
        <span class="reaction-icon" aria-hidden="true">
          <svg><use href="#${reaction.icon}"></use></svg>
        </span>
        <span class="label">${reaction.label}</span>
      `;

      button.addEventListener('pointerdown', () => {
        if (this.reactionLocked) return;

        button.classList.add('is-pressing');
        this.unlockAudio();
      });

      ['pointerup','pointercancel','pointerleave'].forEach(eventName => {
        button.addEventListener(eventName, () => {
          button.classList.remove('is-pressing');
        });
      });

      button.addEventListener('click', () => {
        this.selectReaction(index, button);
      });

      this.els.reactionGrid.appendChild(button);
    });
  },

  loadFeed(index, { immediate = false } = {}) {
    const item = CONFIG.feed[index];

    if (!item) return;

    const reward = this.getRewardForVideo(index);

    this.state.currentVideo = index;
    this.saveState();

    const apply = () => {
      this.els.username.textContent = item.username;
      this.els.description.textContent = item.description;
      this.els.tags.textContent = item.tags;
      this.els.avatar.src = item.avatarSrc;
      this.els.avatar.alt = '';
      this.els.evaluationRewardAmount.textContent = formatMoney(reward);

      [
        this.els.likeCount,
        this.els.commentCount,
        this.els.saveCount,
        this.els.shareCount
      ].forEach((element, countIndex) => {
        element.textContent = item.counts[countIndex];
      });

      this.resetReactionButtons();

      if (this.els.video.getAttribute('src') !== item.src) {
        this.els.video.style.opacity = '0';
        this.els.video.src = item.src;
        this.els.video.muted = true;
        this.els.video.load();
      }

      this.tryPlayVideo();
      this.preloadNextVideo();
      };

    if (immediate || this.reducedMotion) {
      apply();
      return;
    }

    const outgoing = this.els.videoCard.animate(
      [
        { opacity: 1, transform: 'translateY(0)' },
        { opacity: 0, transform: 'translateY(-12px)' }
      ],
      {
        duration: 160,
        easing: 'ease-out',
        fill: 'forwards'
      }
    );

    outgoing.finished
      .then(() => {
        apply();

        this.els.videoCard.animate(
          [
            { opacity: 0, transform: 'translateY(12px)' },
            { opacity: 1, transform: 'translateY(0)' }
          ],
          {
            duration: 230,
            easing: 'cubic-bezier(.2,.8,.25,1)',
            fill: 'both'
          }
        );
      })
      .catch(apply);
  },

  tryPlayVideo() {
    const playPromise = this.els.video.play();

    if (playPromise && playPromise.catch) {
      playPromise.catch(() => {
        this.els.video.muted = true;

        this.els.video.play().catch(() => {});
      });
    }
  },

  preloadNextVideo() {
    const next = CONFIG.feed[this.state.currentVideo + 1];

    if (!next) return;

    if (
      document.querySelector(
        `link[data-preload-video="${next.src}"]`
      )
    ) {
      return;
    }

    const link = document.createElement('link');

    link.rel = 'preload';
    link.as = 'video';
    link.href = next.src;
    link.type = 'video/mp4';
    link.dataset.preloadVideo = next.src;

    document.head.appendChild(link);
  },



  resetReactionButtons() {
    this.reactionLocked = false;
    this.els.reactionGrid.classList.remove('is-resolving');

    this.els.reactionGrid
      .querySelectorAll('.reaction-btn')
      .forEach(button => {
        button.disabled = false;
        button.classList.remove(
          'is-selected',
          'is-pressing'
        );
      });
  },

  selectReaction(index, button) {
    if (this.reactionLocked) return;

    this.reactionLocked = true;
    this.unlockAudio();

    if (navigator.vibrate) {
      navigator.vibrate(20);
    }

    const reaction = CONFIG.reactions[index];
    const item = CONFIG.feed[this.state.currentVideo];
    const reward = this.getRewardForVideo(this.state.currentVideo);

    this.animateReaction(button);
    this.spawnReactionParticles(button, reaction);

    const token = ++this.animationToken;

    window.setTimeout(() => {
      if (token !== this.animationToken) return;

      this.settleReactionVisuals();

      const from = this.state.score;
      const to = from + reward;

      this.state.reactions.push({
        video: this.state.currentVideo,
        reaction: reaction.label,
        reward: reward
      });

      this.state.score = to;
      this.saveState();

      this.animateBalance(
        from,
        to,
        560,
        formatMoney(reward, { signed: true })
      );

      this.showRewardModal(reward);
    }, this.reducedMotion ? 0 : 230);

    window.setTimeout(() => {
      if (token !== this.animationToken) return;

      this.hideRewardModal();

      window.setTimeout(
        () => this.nextVideo(),
        this.reducedMotion ? 0 : 110
      );
    }, this.reducedMotion ? 80 : 1480);
  },

  animateReaction(button) {
    this.els.reactionGrid.classList.add('is-resolving');

    this.els.reactionGrid
      .querySelectorAll('.reaction-btn')
      .forEach(reactionButton => {
        reactionButton.disabled = true;
      });

    button.classList.remove('is-pressing');
    button.classList.add('is-selected');
  },

  settleReactionVisuals() {
    this.els.reactionGrid.classList.remove('is-resolving');

    this.els.reactionGrid
      .querySelectorAll('.reaction-btn')
      .forEach(reactionButton => {
        reactionButton.classList.remove('is-selected', 'is-pressing');
      });
  },

  spawnReactionParticles(button, reaction) {
    const rect = button.getBoundingClientRect();
    const originX = rect.left + rect.width / 2;
    const originY = rect.top + rect.height / 2;

    for (let index = 0; index < 7; index += 1) {
      const particle = document.createElement('span');

      particle.className = 'emoji-particle';
      particle.textContent =
        reaction.particles[index % reaction.particles.length];

      const dx = (Math.random() - .5) * 100;
      const dy = -(60 + Math.random() * 70);

      particle.style.setProperty(
        '--x0',
        `${originX - 12}px`
      );

      particle.style.setProperty(
        '--y0',
        `${originY - 12}px`
      );

      particle.style.setProperty('--dx', `${dx}px`);
      particle.style.setProperty('--dy', `${dy}px`);

      particle.style.setProperty(
        '--rot',
        `${(Math.random() - .5) * 110}deg`
      );

      particle.style.setProperty(
        '--dur',
        `${.62 + Math.random() * .28}s`
      );

      document.body.appendChild(particle);

      particle.addEventListener(
        'animationend',
        () => particle.remove(),
        { once: true }
      );
    }
  },

  showRewardModal(points = 22) {
    this.els.modalAmount.textContent = formatMoney(points, { signed: true });

    this.els.rewardModal.hidden = false;
    this.els.rewardModal.classList.remove('is-closing');

    document.body.style.overflow = 'hidden';

    SoundManager.playReward();

    this.els.confettiLayer.replaceChildren();
    this.createConfetti(56, 'normal');
  },

  hideRewardModal(immediate = false) {
    if (this.els.rewardModal.hidden) return;

    if (immediate || this.reducedMotion) {
      this.clearConfetti(true);
      this.els.rewardModal.hidden = true;
      this.els.rewardModal.classList.remove('is-closing');
      document.body.style.overflow = '';
      return;
    }

    this.clearConfetti(false);
    this.els.rewardModal.classList.add('is-closing');

    window.setTimeout(() => {
      this.els.rewardModal.hidden = true;
      this.els.rewardModal.classList.remove('is-closing');
      document.body.style.overflow = '';
    }, 170);
  },

  animateBalance(from, to, duration = 700, floatText = '') {
    this.animateNumber(
      from,
      to,
      duration,
      value => {
        this.els.balance.textContent =
          formatMoney(value);
      }
    );

    this.els.wallet.classList.remove('is-pulsing');
    void this.els.wallet.offsetWidth;
    this.els.wallet.classList.add('is-pulsing');

    if (floatText) {
      this.els.walletFloat.textContent = floatText;

      this.els.walletFloat.classList.remove('show');
      void this.els.walletFloat.offsetWidth;
      this.els.walletFloat.classList.add('show');
    }
  },

  animateResultCounter() {
    // The pre-click reward strip was removed by design.
  },

  animateNumber(from, to, duration, render) {
    if (this.reducedMotion || duration <= 0) {
      render(to);
      return;
    }

    const startedAt = performance.now();
    const easeOut = t => 1 - Math.pow(1 - t, 3);

    const frame = now => {
      const progress = Math.min(
        1,
        (now - startedAt) / duration
      );

      render(
        from +
        (to - from) *
        easeOut(progress)
      );

      if (progress < 1) {
        requestAnimationFrame(frame);
      }
    };

    requestAnimationFrame(frame);
  },

  setBalance(value, animate = false) {
    if (animate) {
      const current =
        Number(
          this.els.balance.textContent.replace(
            /[^0-9.-]/g,
            ''
          )
        ) || 0;

      this.animateBalance(current, value);
    } else {
      this.els.balance.textContent =
        formatMoney(value);
    }
  },

  nextVideo() {
    const nextIndex = this.state.currentVideo + 1;

    if (nextIndex < CONFIG.feed.length) {
      this.loadFeed(nextIndex);
      return;
    }

    this.showScreen('spin');
  },

  togglePlay() {
    this.unlockAudio();

    if (this.els.video.paused) {
      this.tryPlayVideo();
    } else {
      this.els.video.pause();
    }
  },

  updatePlayUI() {
    // Playback controls intentionally hidden.
  },

  toggleSound() {
    this.unlockAudio();

    this.state.videoSoundOn =
      !this.state.videoSoundOn;

    this.els.video.muted =
      !this.state.videoSoundOn;

    if (this.state.videoSoundOn) {
      this.state.soundEnabled = true;
      SoundManager.setEnabled(true);
      this.tryPlayVideo();
    }

    this.saveState();
  },

  updateSoundUI() {
    // Video stays muted; the Sound On control is intentionally hidden.
  },

  shareExperience() {

    const url = location.href;

    if (navigator.share) {
      navigator.share({
        title: CONFIG.brandName,
        url
      }).catch(() => {});
      return;
    }

    navigator.clipboard
      ?.writeText(url)
      .catch(() => {});
  },

  buildWheel() {
    const count = CONFIG.wheel.length;
    const centerX = 200;
    const centerY = 200;
    const radius = 184;

    const polar = (angle, targetRadius = radius) => {
      const radians = angle * Math.PI / 180;

      return [
        centerX + Math.cos(radians) * targetRadius,
        centerY + Math.sin(radians) * targetRadius
      ];
    };

    const paths = [];
    const labels = [];

    for (let index = 0; index < count; index += 1) {
      const start = -90 + index * (360 / count);
      const end = -90 + (index + 1) * (360 / count);

      const [x1, y1] = polar(start);
      const [x2, y2] = polar(end);

      const fill = index % 2 === 0
        ? '#ff1717'
        : '#0f0f0f';

      paths.push(`
        <path
          d="
            M ${centerX} ${centerY}
            L ${x1.toFixed(3)} ${y1.toFixed(3)}
            A ${radius} ${radius} 0 0 1
            ${x2.toFixed(3)} ${y2.toFixed(3)}
            Z
          "
          fill="${fill}"
          stroke="#000"
          stroke-width="1"
        />
      `);

      const middle = (start + end) / 2;
      const [textX, textY] = polar(middle, 126);
      const rotation = (middle + 90).toFixed(2);

      if (index === 0) {
        labels.push(`
          <text
            x="${textX.toFixed(2)}"
            y="${textY.toFixed(2)}"
            fill="#fff"
            font-size="17"
            font-weight="900"
            text-anchor="middle"
            dominant-baseline="middle"
            transform="
              rotate(
                ${rotation}
                ${textX.toFixed(2)}
                ${textY.toFixed(2)}
              )
            "
          >
            <tspan x="${textX.toFixed(2)}" dy="-8">TRY</tspan>
            <tspan x="${textX.toFixed(2)}" dy="18">AGAIN</tspan>
          </text>
        `);

        continue;
      }

      labels.push(`
        <text
          x="${textX.toFixed(2)}"
          y="${textY.toFixed(2)}"
          fill="#fff"
          font-size="31"
          font-weight="900"
          text-anchor="middle"
          dominant-baseline="middle"
          transform="
            rotate(
              ${rotation}
              ${textX.toFixed(2)}
              ${textY.toFixed(2)}
            )
          "
        >${CONFIG.wheel[index]}X</text>
      `);
    }

    this.els.wheelRotator.innerHTML = `
      <svg
        viewBox="0 0 400 400"
        role="img"
        aria-label="Bonus wheel"
      >
        <circle cx="200" cy="200" r="193" fill="#fe2c55" />
        ${paths.join('')}
        <circle
          cx="200"
          cy="200"
          r="186"
          fill="none"
          stroke="#fe2c55"
          stroke-width="9"
        />
        ${labels.join('')}
      </svg>
    `;

    this.els.wheelRotator.style.transform =
      `rotate(${this.state.wheelRotation || 0}deg)`;
  },

  restoreSpinState() {
    this.els.wheelRotator.style.transition = 'none';

    this.els.wheelRotator.style.transform =
      `rotate(${this.state.wheelRotation || 0}deg)`;

    this.state.spinning = false;

    if (
      this.state.spinDone &&
      this.state.spinResult === 5
    ) {
      this.els.spinButton.hidden = true;
      this.els.spinButton.disabled = true;

      this.showSpinResult(
        5,
        false
      );

      return;
    }

    this.els.spinButton.hidden = false;
    this.els.spinButton.disabled = false;
    this.els.continueToVsl.hidden = true;

    if (this.state.spinAttempt >= 1) {
      this.els.spinButton.textContent = 'TRY AGAIN';

      this.els.spinResultTitle.textContent = 'TRY AGAIN';
      this.els.spinResultText.textContent =
        'You unlocked one more spin.';

      this.els.spinResult.hidden = false;
      return;
    }

    this.els.spinButton.textContent = 'SPIN NOW';
    this.els.spinResult.hidden = true;
  },

  calculateWheelResult() {
    if (this.state.spinAttempt === 0) {
      return 0;
    }

    const fiveXIndex = CONFIG.wheel.indexOf(5);
    return fiveXIndex >= 0 ? fiveXIndex : 0;
  },

  spinWheel() {
    if (
      this.state.spinning ||
      this.state.spinDone
    ) {
      return false;
    }

    this.unlockAudio();
    this.state.spinning = true;

    this.els.spinButton.hidden = false;
    this.els.spinButton.disabled = true;
    this.els.spinButton.textContent =
      'SPINNING...';

    this.els.spinResult.hidden = true;
    this.els.continueToVsl.hidden = true;

    this.els.wheelShell.classList.add(
      'is-spinning'
    );

    const targetIndex =
      this.calculateWheelResult();

    this.activeSpinAttempt =
      this.state.spinAttempt;

    this.state.spinAttempt += 1;
    this.saveState();

    this.wheelResultIndex =
      targetIndex;

    const segmentAngle =
      360 / CONFIG.wheel.length;

    const targetNormalized =
      this.mod(
        -(
          targetIndex *
          segmentAngle +
          segmentAngle / 2
        ),
        360
      );

    const current =
      Number(
        this.state.wheelRotation || 0
      );

    const currentNormalized =
      this.mod(current, 360);

    const forwardDelta =
      this.mod(
        targetNormalized -
        currentNormalized,
        360
      );

    const extraTurns =
      6 +
      Math.floor(
        Math.random() * 3
      );

    const targetRotation =
      current +
      extraTurns * 360 +
      forwardDelta;

    const duration =
      4.4 +
      Math.random() * .8;

    this.state.wheelRotation =
      targetRotation;

    this.saveState();

    const wheel =
      this.els.wheelRotator;

    wheel.style.transition = 'none';
    wheel.style.transform =
      `rotate(${current}deg)`;

    void wheel.offsetWidth;

    wheel.style.transition =
      `transform ${duration}s cubic-bezier(.08,.72,.18,1)`;

    const onTransitionEnd = event => {
      if (
        event.propertyName !==
        'transform'
      ) {
        return;
      }

      wheel.removeEventListener(
        'transitionend',
        onTransitionEnd
      );

      this.finishSpin();
    };

    wheel.addEventListener(
      'transitionend',
      onTransitionEnd
    );

    this.lastTickSector = null;
    this.monitorWheelTicks();

    requestAnimationFrame(() => {
      wheel.style.transform =
        `rotate(${targetRotation}deg)`;
    });

    return true;
  },

  monitorWheelTicks() {
    cancelAnimationFrame(
      this.tickRaf
    );

    const frame = () => {
      if (!this.state.spinning) return;

      const angle =
        this.getCurrentWheelAngle();

      const sector =
        Math.floor(
          this.mod(angle, 360) /
          (
            360 /
            CONFIG.wheel.length
          )
        );

      if (
        this.lastTickSector === null
      ) {
        this.lastTickSector =
          sector;
      } else if (
        sector !==
        this.lastTickSector
      ) {
        this.lastTickSector =
          sector;

        this.animateWheelPointer();
      }

      this.tickRaf =
        requestAnimationFrame(
          frame
        );
    };

    this.tickRaf =
      requestAnimationFrame(
        frame
      );
  },

  getCurrentWheelAngle() {
    const transform =
      getComputedStyle(
        this.els.wheelRotator
      ).transform;

    if (
      !transform ||
      transform === 'none'
    ) {
      return 0;
    }

    try {
      const matrix =
        new DOMMatrixReadOnly(
          transform
        );

      return (
        Math.atan2(
          matrix.b,
          matrix.a
        ) *
        180 /
        Math.PI
      );
    } catch (_) {
      return 0;
    }
  },

  animateWheelPointer() {
    // Intentionally visual-only: the wheel has no spinning/tick sound.
    this.els.wheelPointer
      .classList.remove('tick');

    void this.els.wheelPointer
      .offsetWidth;

    this.els.wheelPointer
      .classList.add('tick');
  },

  finishSpin() {
    cancelAnimationFrame(this.tickRaf);

    this.state.spinning = false;

    this.els.wheelShell.classList.remove('is-spinning');
    this.els.wheelShell.classList.add('is-bouncing');

    window.setTimeout(() => {
      this.els.wheelShell.classList.remove('is-bouncing');
    }, 460);

    this.animateWheelPointer();

    if (this.activeSpinAttempt === 0) {
      this.state.spinDone = false;
      this.state.spinResult = null;
      this.saveState();

      this.els.spinButton.hidden = false;
      this.els.spinButton.disabled = false;
      this.els.spinButton.textContent = 'TRY AGAIN';

      this.els.spinResultTitle.textContent = 'TRY AGAIN';
      this.els.spinResultText.textContent =
        'You unlocked one more spin.';
      this.els.spinResult.hidden = false;
      this.els.continueToVsl.hidden = true;

      return;
    }

    const multiplier = 5;

    this.state.spinResult = multiplier;
    this.state.spinDone = true;

    const from = this.state.score;
    const to = from * multiplier;

    this.state.score = to;
    this.saveState();

    SoundManager.playReward();
    this.createConfetti(110, 'jackpot');

    this.animateBalance(
      from,
      to,
      900,
      formatMoney(to - from, { signed: true })
    );

    this.showSpinResult(multiplier, true);
  },

  detectWheelSegment() {
    const rotation =
      this.mod(
        this.state.wheelRotation,
        360
      );

    const relative =
      this.mod(
        -rotation,
        360
      );

    return Math.floor(
      relative /
      (
        360 /
        CONFIG.wheel.length
      )
    );
  },

  showSpinResult(
    multiplier,
    animate = true
  ) {
    this.els.spinButton.hidden = true;
    this.els.spinButton.disabled = true;

    this.els.continueToVsl.hidden = false;

    this.els.spinResultTitle.textContent =
      `${multiplier}X BONUS UNLOCKED`;

    this.els.spinResultText.textContent =
      'Your bonus has been applied to your balance.';

    this.els.spinResult.hidden = false;

    if (animate) {
      this.els.spinResult.style.animation = 'none';

      void this.els.spinResult.offsetWidth;

      this.els.spinResult.style.animation = '';
    }
  },

  clearConfetti(immediate = false) {
    const pieces = [
      ...this.els.confettiLayer.querySelectorAll('.confetti-piece')
    ];

    if (!pieces.length) return;

    if (immediate || this.reducedMotion) {
      this.els.confettiLayer.replaceChildren();
      return;
    }

    pieces.forEach(piece => {
      piece.classList.add('is-finishing');
    });

    window.setTimeout(() => {
      this.els.confettiLayer.replaceChildren();
    }, 180);
  },

  createConfetti(
    count = 70,
    intensity = 'normal'
  ) {
    const colors = [
      '#fe2c55',
      '#25f4ee',
      '#ffd600',
      '#ffffff',
      '#8b5cf6'
    ];

    for (
      let index = 0;
      index < count;
      index += 1
    ) {
      const piece =
        document.createElement('i');

      piece.className =
        'confetti-piece';

      const width =
        5 +
        Math.random() * 7;

      const height =
        7 +
        Math.random() * 11;

      piece.style.left =
        `${Math.random() * 100}%`;

      piece.style.top =
        `${-3 + Math.random() * 13}vh`;

      piece.style.setProperty(
        '--w',
        `${width}px`
      );

      piece.style.setProperty(
        '--h',
        `${height}px`
      );

      piece.style.setProperty(
        '--c',
        colors[
          Math.floor(
            Math.random() *
            colors.length
          )
        ]
      );

      piece.style.setProperty(
        '--drift',
        `${
          (Math.random() - .5) *
          (
            intensity === 'jackpot'
              ? 260
              : 180
          )
        }px`
      );

      piece.style.setProperty(
        '--spin',
        `${
          (Math.random() - .5) *
          1100
        }deg`
      );

      const baseDuration =
        intensity === 'jackpot'
          ? 2.2 + Math.random() * 1.4
          : 1.9 + Math.random() * 1.7;

      piece.style.setProperty(
        '--d',
        `${baseDuration}s`
      );

      piece.style.setProperty(
        '--delay',
        `${Math.random() * .22}s`
      );

      this.els.confettiLayer
        .appendChild(piece);

      piece.addEventListener(
        'animationend',
        () => piece.remove(),
        { once: true }
      );
    }
  },

  mountVturb() {
    if (this.vturbMounted || !this.els.vslWrapper) return;

    this.vturbMounted = true;
    this.els.vslWrapper.replaceChildren();

    const player = document.createElement('vturb-smartplayer');
    player.id = CONFIG.vsl.playerId;
    player.style.cssText =
      'display:block;margin:0 auto;width:100%;max-width:400px';

    const placeholder = document.createElement('div');
    placeholder.className = 'vturb-player-placeholder';
    placeholder.style.cssText =
      'position:relative;width:100%;padding:178.21782178217822% 0 0;z-index:0;background-color:black';

    player.appendChild(placeholder);
    this.els.vslWrapper.appendChild(player);

    const script = document.createElement('script');
    script.src = CONFIG.vsl.playerScript;
    script.async = true;
    script.dataset.pgVturbLazy = 'v8';
    document.head.appendChild(script);

    document.dispatchEvent(new CustomEvent('pg:vturb-mounted'));
  },

  showVSL() {
    // Ensure the VSL and its custom CTA see the complete original query.
    this.syncTrackingParamsToUrl();

    this.state.vslUnlocked = true;
    this.saveState();
    this.showScreen('vsl');
  },

  getTrackingParams() {
    // PALINSKI FUNNEL PARAMETER BRIDGE V9
    //
    // Priority, from oldest to newest:
    // 1. query injected by the private PHP router;
    // 2. legacy attribution captured by earlier versions;
    // 3. V9 attribution already captured in this tab;
    // 4. current URL (wins on duplicate keys).
    //
    // Every external key is preserved. Only internal routing/state keys are
    // stripped before checkout.
    const STORAGE = 'pg_funnel_attribution_v9';
    const LEGACY_STORAGES = [
      'pg_funnel_attribution_v7',
      'pg_funnel_attribution_v8'
    ];

    const output = new URLSearchParams();

    const isInternal = key => {
      const normalized = String(key || '').trim().toLowerCase();

      return (
        !normalized ||
        normalized === 'step' ||
        normalized === 'pg_funnel_internal' ||
        normalized.startsWith('pg_funnel_')
      );
    };

    const merge = raw => {
      if (!raw) return;

      const params =
        raw instanceof URLSearchParams
          ? raw
          : new URLSearchParams(
              String(raw).replace(/^\?/, '')
            );

      params.forEach((value, key) => {
        if (!isInternal(key) && value !== '') {
          output.set(key, value);
        }
      });
    };

    merge(window.__PG_FUNNEL_INITIAL_QUERY__ || '');

    LEGACY_STORAGES.forEach(key => {
      merge(storage.get(sessionStorage, key) || '');
    });

    merge(storage.get(sessionStorage, STORAGE) || '');
    merge(location.search);

    storage.set(
      sessionStorage,
      STORAGE,
      output.toString()
    );

    return output;
  },

  syncTrackingParamsToUrl() {
    const tracking = this.getTrackingParams();
    const url = new URL(location.href);
    let changed = false;

    ['step'].forEach(key => {
      if (url.searchParams.has(key)) {
        url.searchParams.delete(key);
        changed = true;
      }
    });

    tracking.forEach((value, key) => {
      if (url.searchParams.get(key) !== value) {
        url.searchParams.set(key, value);
        changed = true;
      }
    });

    if (changed) {
      history.replaceState({}, '', url.toString());
    }

    return tracking;
  },

  prefillPopupForm(form) {
    if (!(form instanceof HTMLFormElement)) return;

    const params = this.syncTrackingParamsToUrl();

    const firstNonEmpty = aliases => {
      for (const key of aliases) {
        const value = params.get(key);
        if (value && value.trim()) return value.trim();
      }

      return '';
    };

    const firstName = form.elements.namedItem('first_name');
    const lastName = form.elements.namedItem('last_name');
    const email = form.elements.namedItem('email');

    if (firstName && !String(firstName.value || '').trim()) {
      firstName.value = firstNonEmpty([
        'first_name',
        'firstname',
        'firstName'
      ]);
    }

    if (lastName && !String(lastName.value || '').trim()) {
      lastName.value = firstNonEmpty([
        'last_name',
        'lastname',
        'lastName'
      ]);
    }

    if (email && !String(email.value || '').trim()) {
      email.value = firstNonEmpty([
        'email',
        'email_address',
        'emailAddress'
      ]);
    }
  },

  buildPopupCheckoutUrl(form) {
    const params = this.getTrackingParams();

    if (form instanceof HTMLFormElement) {
      const data = new FormData(form);

      // Preserve every named popup field, not just the three current fields.
      for (const [key, rawValue] of data.entries()) {
        if (typeof rawValue !== 'string') continue;

        const value = rawValue.trim();

        if (key && value !== '') {
          params.set(key, value);
        }
      }
    }

    params.set('country', 'US');
    params.set('i_order_as', 'private');
    params.set('first_paymethod', 'creditcard');

    const existingZip =
      params.get('zipcode') ||
      params.get('zip') ||
      params.get('zip_code') ||
      params.get('postal_code') ||
      params.get('postcode');

    if (!existingZip) {
      params.set('zipcode', '10001');
    } else if (!params.has('zipcode')) {
      params.set('zipcode', existingZip);
    }

    if (!params.has('ttclid')) {
      params.set('ttclid', '');
    }

    const target = new URL(CONFIG.finalUrl, location.href);

    // CONFIG.finalUrl may contain its own fixed query values in the future.
    // Original/form values are then merged over them.
    params.forEach((value, key) => {
      target.searchParams.set(key, value);
    });

    return target.toString();
  },

  installPopupParamBridge() {
    if (this._popupParamBridgeInstalled) return;

    this._popupParamBridgeInstalled = true;
    this._popupParamObservers = new WeakSet();

    const findInPath = (event, id) => {
      const path =
        typeof event.composedPath === 'function'
          ? event.composedPath()
          : [];

      for (const node of path) {
        if (
          node instanceof Element &&
          node.id === id
        ) {
          return node;
        }
      }

      const target =
        event.target instanceof Element
          ? event.target
          : null;

      return target?.closest?.(`#${id}`) || null;
    };

    const submitPopup = (event, form) => {
      if (!form || form.id !== 'pgform') return;
      if (event.__pgV9Handled) return;

      event.__pgV9Handled = true;
      event.preventDefault();
      event.stopImmediatePropagation();

      if (!form.reportValidity()) return;

      const button =
        form.querySelector('#pggo') ||
        document.getElementById('pggo');

      if (button) {
        button.disabled = true;
        button.textContent = 'Loading...';
      }

      const destination =
        this.buildPopupCheckoutUrl(form);

      location.href = destination;
    };

    const bindForm = form => {
      if (!(form instanceof HTMLFormElement)) return;
      if (form.dataset.pgParamBridge === 'v9') return;

      form.dataset.pgParamBridge = 'v9';

      // Capture phase runs before the inline onsubmit supplied by the CTA.
      form.addEventListener(
        'submit',
        event => submitPopup(event, form),
        true
      );

      this.prefillPopupForm(form);
    };

    const bindOpenButton = button => {
      if (!(button instanceof Element)) return;
      if (button.dataset.pgParamBridge === 'v9') return;

      button.dataset.pgParamBridge = 'v9';

      button.addEventListener(
        'click',
        () => {
          const host = button.closest('#pgv');
          const form =
            host?.querySelector('#pgform') ||
            document.getElementById('pgform');

          if (form) {
            this.prefillPopupForm(form);
          } else {
            this.syncTrackingParamsToUrl();
          }
        },
        true
      );
    };

    const bindRoot = root => {
      if (!root || !root.querySelectorAll) return;

      root
        .querySelectorAll('#pgform')
        .forEach(bindForm);

      root
        .querySelectorAll('#pgopen')
        .forEach(bindOpenButton);

      if (
        root instanceof ShadowRoot &&
        !this._popupParamObservers.has(root)
      ) {
        const observer = new MutationObserver(() => {
          bindRoot(root);
        });

        observer.observe(root, {
          childList: true,
          subtree: true
        });

        this._popupParamObservers.add(root);
      }
    };

    const scan = () => {
      bindRoot(document);

      document
        .querySelectorAll('vturb-smartplayer')
        .forEach(player => {
          if (player.shadowRoot) {
            bindRoot(player.shadowRoot);
          }
        });
    };

    // Public helpers: the supplied CTA can also call these directly.
    window.PG_FUNNEL_GET_PARAMS = () =>
      this.getTrackingParams().toString();

    window.PG_FUNNEL_SYNC_PARAMS = () =>
      this.syncTrackingParamsToUrl().toString();

    window.PG_FUNNEL_BUILD_CHECKOUT_URL = form =>
      this.buildPopupCheckoutUrl(form);

    document.addEventListener(
      'click',
      event => {
        const open = findInPath(event, 'pgopen');
        if (!open) return;

        const host = open.closest?.('#pgv');
        const form =
          host?.querySelector?.('#pgform') ||
          document.getElementById('pgform');

        if (form) {
          this.prefillPopupForm(form);
        } else {
          this.syncTrackingParamsToUrl();
        }
      },
      true
    );

    // Dynamic CTA insertion is supported.
    const documentObserver = new MutationObserver(scan);

    documentObserver.observe(
      document.documentElement,
      {
        childList: true,
        subtree: true
      }
    );

    ['pg:vturb-mounted', 'player:ready'].forEach(eventName => {
      document.addEventListener(
        eventName,
        () => {
          [0, 100, 500, 1500].forEach(delay => {
            window.setTimeout(scan, delay);
          });
        }
      );
    });

    scan();
  },

  appendTrackingParams(url) {
    if (
      !url ||
      url ===
      'COLOCAR_URL_FINAL_AQUI'
    ) {
      return url;
    }

    const output =
      new URL(
        url,
        location.href
      );

    const tracking =
      this.getTrackingParams();

    tracking.forEach(
      (value, key) => {
        if (
          !output.searchParams.has(key)
        ) {
          output.searchParams.set(
            key,
            value
          );
        }
      }
    );

    return output.toString();
  },

  goFinal() {
    if (
      !CONFIG.finalUrl ||
      CONFIG.finalUrl ===
      'COLOCAR_URL_FINAL_AQUI'
    ) {
      alert(
        'Configure CONFIG.finalUrl in js/app.js before publishing.'
      );
      return;
    }

    location.href =
      this.appendTrackingParams(
        CONFIG.finalUrl
      );
  },

  mod(number, divisor) {
    return (
      (
        number %
        divisor
      ) +
      divisor
    ) % divisor;
  },

  exposeDebug() {
    const debugSpin = () => {
      if (this.state.spinDone) {
        this.state.spinDone = false;
        this.state.spinResult = null;
        this.state.spinning = false;

        this.els.spinResult.hidden = true;
        this.els.continueToVsl.hidden = true;

        this.els.spinButton.disabled = false;
        this.els.spinButton.textContent = 'SPIN NOW';
      }

      if (
        this.state.screen !== 'spin'
      ) {
        this.showScreen(
          'spin',
          { immediate: true }
        );
      }

      return this.spinWheel();
    };

    window.TikTokRewardsDebug = {
      reset: () => this.resetExperience(),
      spin: debugSpin,
      reward: (points = 22) => this.showRewardModal(points),
      confetti: (count = 80) => this.createConfetti(count, 'jackpot'),
      params: () => this.getTrackingParams().toString(),
      checkoutUrl: () => this.buildPopupCheckoutUrl(
        document.getElementById('pgform')
      ),
      state: () => ({ ...this.state })
    };

    window.spinWheel = debugSpin;
    window.resetExperience =
      () => this.resetExperience();
  }
};

window.addEventListener(
  'DOMContentLoaded',
  () => App.initApp(),
  { once: true }
);


/* =========================================================
   VTurb native form blur sync
   ========================================================= */
(() => {
  const BODY_CLASS = 'vturb-native-form-open';
  const PLAYER_SELECTOR = 'vturb-smartplayer';
  let player = null;
  let pollId = 0;
  let observer = null;
  let lastOpen = false;

  const isVisible = element => {
    if (!(element instanceof Element)) return false;

    const style = getComputedStyle(element);
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      Number(style.opacity || 1) <= 0.01
    ) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    return rect.width > 8 && rect.height > 8;
  };

  const looksLikeVisibleForm = root => {
    if (!root || !root.querySelectorAll) return false;

    const fields = root.querySelectorAll(
      'input:not([type="hidden"]), textarea, select'
    );

    for (const field of fields) {
      if (isVisible(field)) return true;
    }

    const dialogs = root.querySelectorAll(
      [
        '[role="dialog"]',
        '[aria-modal="true"]',
        '[class*="modal" i]',
        '[class*="popup" i]',
        '[class*="form" i]',
        '[id*="modal" i]',
        '[id*="popup" i]',
        '[id*="form" i]'
      ].join(',')
    );

    for (const dialog of dialogs) {
      if (!isVisible(dialog)) continue;

      const hasField = dialog.querySelector(
        'input:not([type="hidden"]), textarea, select'
      );

      if (hasField) return true;
    }

    return false;
  };

  const scanShadowTree = root => {
    if (!root) return false;

    if (looksLikeVisibleForm(root)) {
      return true;
    }

    if (!root.querySelectorAll) return false;

    const all = root.querySelectorAll('*');
    const limit = Math.min(all.length, 900);

    for (let index = 0; index < limit; index += 1) {
      const element = all[index];

      if (
        element.shadowRoot &&
        scanShadowTree(element.shadowRoot)
      ) {
        return true;
      }
    }

    return false;
  };

  const setOpen = open => {
    if (open === lastOpen) return;

    lastOpen = open;
    document.body.classList.toggle(BODY_CLASS, open);
  };

  const scan = () => {
    if (!player || !document.contains(player)) {
      player = document.querySelector(PLAYER_SELECTOR);
    }

    if (!player) {
      setOpen(false);
      return;
    }

    if (document.body.dataset.activeScreen !== 'vsl') {
      setOpen(false);
      return;
    }

    const open =
      scanShadowTree(player.shadowRoot) ||
      scanShadowTree(player);

    setOpen(Boolean(open));
  };

  const observePlayer = () => {
    if (!player) return;

    if (observer) {
      observer.disconnect();
    }

    observer = new MutationObserver(() => {
      window.setTimeout(scan, 0);
      window.setTimeout(scan, 120);
    });

    observer.observe(player, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        'class',
        'style',
        'hidden',
        'aria-hidden',
        'aria-expanded'
      ]
    });

    if (player.shadowRoot) {
      observer.observe(player.shadowRoot, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: [
          'class',
          'style',
          'hidden',
          'aria-hidden',
          'aria-expanded'
        ]
      });
    }
  };

  const bind = () => {
    player = document.querySelector(PLAYER_SELECTOR);

    if (!player) {
      return;
    }

    observePlayer();
    scan();

    player.addEventListener(
      'pointerup',
      () => {
        window.setTimeout(scan, 50);
        window.setTimeout(scan, 180);
        window.setTimeout(scan, 500);
      },
      true
    );

    document.addEventListener(
      'focusin',
      event => {
        const path =
          typeof event.composedPath === 'function'
            ? event.composedPath()
            : [];

        const focusInsidePlayer =
          path.includes(player);

        const focusedField =
          path.some(node =>
            node instanceof Element &&
            node.matches?.(
              'input:not([type="hidden"]), textarea, select'
            )
          );

        if (focusInsidePlayer && focusedField) {
          setOpen(true);
        }

        window.setTimeout(scan, 80);
      },
      true
    );

    pollId = window.setInterval(scan, 320);
  };

  document.addEventListener(
    'player:ready',
    () => {
      window.setTimeout(() => {
        player =
          document.querySelector(PLAYER_SELECTOR) ||
          player;

        observePlayer();
        scan();
      }, 0);
    }
  );

  document.addEventListener(
    'visibilitychange',
    () => {
      if (!document.hidden) scan();
    }
  );

  document.addEventListener(
    'pg:vturb-mounted',
    () => window.setTimeout(bind, 0)
  );

  bind();

  window.addEventListener(
    'beforeunload',
    () => {
      if (pollId) clearInterval(pollId);
      observer?.disconnect();
    },
    { once: true }
  );
})();

