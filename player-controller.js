// PlayerController.js
// A universal First-Person Player Controller for Three.js
// - PC (keyboard, mouse, pointer lock) & Touchscreen (joystick, drag, jump/run buttons) support
// - Camera group and controls, no map or scene dependencies
// - Drop-in: import, instantiate, add controller.cameraGroup to your scene
// - Handles all controls, camera bob, jump/run, and is easily extendable

import * as THREE from 'three';

export default class PlayerController {
  /**
   * @param {THREE.PerspectiveCamera} camera - Camera to control (will be attached as child)
   * @param {HTMLElement} domElement - Renderer DOM element for pointer lock and events
   * @param {Object} opts - { baseSpeed, runMultiplier, jumpStrength, gravity, height }
   */
  constructor(camera, domElement, opts = {}) {
    this.camera = camera;
    this.domElement = domElement;

    // Movement params (customize as needed)
    this.baseSpeed = opts.baseSpeed ?? 0.1;
    this.runMultiplier = opts.runMultiplier ?? 1.8;
    this.jumpStrength = opts.jumpStrength ?? 0.12;
    this.gravity = opts.gravity ?? -0.005;
    this.height = opts.height ?? 1.6;

    // Groups & state
    this.cameraGroup = new THREE.Object3D();
    this.cameraGroup.position.set(0, this.height, 0);
    this.camera.rotation.set(0, 0, 0);
    this.cameraGroup.add(this.camera);

    this.keys = { forward: false, backward: false, left: false, right: false };
    this.joystickInput = { x: 0, y: 0 };
    this.isRunning = false;
    this.isJumping = false;
    this.velocityY = 0;
    this.lastWalkOffset = new THREE.Vector3();
    this.walkTime = 0;

    // Camera bob (head vibration)
    this.vibrationAmplitudeY = 0.06;
    this.vibrationAmplitudeX = 0.04;
    this.vibrationFrequency = 8;

    // Touch-related
    this.dragTouchId = null;
    this.joystickTouchId = null;
    this.runTouchId = null;
    this.prevX = 0;
    this.prevY = 0;

    // Setup events, UI if not present
    this._setupJoystickElements();
    this._setupInputListeners();
  }

  // ------------ Main update (call every frame) -----------------
  update(delta) {
    // Remove last bob offset before moving
    this.camera.position.sub(this.lastWalkOffset);
    this.lastWalkOffset.set(0, 0, 0);

    // Direction & right vectors
    const dir = new THREE.Vector3();
    this.cameraGroup.getWorldDirection(dir);
    dir.y = 0; dir.normalize();
    const right = new THREE.Vector3().crossVectors(dir, this.cameraGroup.up).normalize();

    // Movement vector based on input
    let moveVec = new THREE.Vector3();
    let speed = this.isRunning ? this.baseSpeed * this.runMultiplier : this.baseSpeed;
    const input = this._getInputVector();
    const moving = input.x !== 0 || input.y !== 0;
    if (moving) {
      moveVec.add(dir.clone().multiplyScalar(-input.y * speed));
      moveVec.add(right.clone().multiplyScalar(-input.x * speed));
    }

    // Gravity & Jump
    this.velocityY += this.gravity;
    let newY = this.cameraGroup.position.y + this.velocityY;
    if (newY < this.height) { newY = this.height; this.isJumping = false; this.velocityY = 0; }

    // Move group
    this.cameraGroup.position.add(moveVec);
    this.cameraGroup.position.y = newY;

    // Camera bob
    if (moving && this.cameraGroup.position.y === this.height) {
      this.walkTime += delta * (this.isRunning ? 1.5 : 1.0);
      this.lastWalkOffset.x = Math.sin(this.walkTime * this.vibrationFrequency) * this.vibrationAmplitudeX;
      this.lastWalkOffset.y = Math.abs(Math.sin(this.walkTime * this.vibrationFrequency * 0.5)) * this.vibrationAmplitudeY;
      this.camera.position.add(this.lastWalkOffset);
    } else {
      this.walkTime = 0;
    }
  }

  getVelocity() {
    return {
      x: this._getInputVector().x * (this.isRunning ? this.baseSpeed * this.runMultiplier : this.baseSpeed),
      y: this.velocityY
    };
  }

  isGrounded() {
    return this.cameraGroup.position.y === this.height;
  }

  // ------------ Input vector combining keys/joystick -----------
  _getInputVector() {
    // Keyboard
    let x = 0, y = 0;
    if (this.keys.forward) y += 1;
    if (this.keys.backward) y -= 1;
    if (this.keys.left) x -= 1;
    if (this.keys.right) x += 1;
    const joyMag = Math.abs(this.joystickInput.x) + Math.abs(this.joystickInput.y);
    const keyMag = Math.abs(x) + Math.abs(y);
    if (joyMag > 0) return { x: this.joystickInput.x, y: this.joystickInput.y };
    if (keyMag > 0) {
      const mag = Math.sqrt(x*x + y*y) || 1;
      return { x: x/mag, y: y/mag };
    }
    return { x: 0, y: 0 };
  }

  // ------------ Joystick/Touch UI setup -----------
  _setupJoystickElements() {
    if (!document.getElementById('joystick')) {
      const joystick = document.createElement('div');
      joystick.id = 'joystick';
      Object.assign(joystick.style, {
        position: 'absolute', bottom: '20px', left: '20px', width: '120px', height: '120px',
        background: 'rgba(255,255,255,0.1)', borderRadius: '50%', touchAction: 'none', zIndex: 10,
      });
      document.body.appendChild(joystick);

      const stick = document.createElement('div');
      stick.id = 'stick';
      Object.assign(stick.style, {
        position: 'absolute', left: '40px', top: '40px', width: '40px', height: '40px',
        background: '#fff', borderRadius: '50%',
      });
      joystick.appendChild(stick);
    }
    if (!document.getElementById('jumpBtn')) {
      const jumpBtn = document.createElement('div');
      jumpBtn.id = 'jumpBtn'; jumpBtn.textContent = 'Jump';
      Object.assign(jumpBtn.style, {
        position: 'absolute', width: '80px', height: '80px',
        background: 'rgba(255,255,255,0.2)', borderRadius: '50%',
        textAlign: 'center', lineHeight: '80px', color: '#fff', fontSize: '18px',
        userSelect: 'none', zIndex: 10, bottom: '40px', right: '20px',
      });
      document.body.appendChild(jumpBtn);
    }
    if (!document.getElementById('runBtn')) {
      const runBtn = document.createElement('div');
      runBtn.id = 'runBtn'; runBtn.textContent = 'Run';
      Object.assign(runBtn.style, {
        position: 'absolute', width: '80px', height: '80px',
        background: 'rgba(255,255,255,0.2)', borderRadius: '50%',
        textAlign: 'center', lineHeight: '80px', color: '#fff', fontSize: '18px',
        userSelect: 'none', zIndex: 10, bottom: '140px', right: '20px',
      });
      document.body.appendChild(runBtn);
    }
    this.stick = document.getElementById('stick');
    this.joystick = document.getElementById('joystick');
    this.joystickRadius = this.joystick.offsetWidth / 2;
  }

  // ----------- Input events (keyboard, mouse, touch) --------------
  _setupInputListeners() {
    // Bind methods
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onTouchStart = this._onTouchStart.bind(this);
    this._onTouchMove = this._onTouchMove.bind(this);
    this._onTouchEnd = this._onTouchEnd.bind(this);

    // Pointer lock for desktop
    this.domElement.addEventListener('click', () => { this.domElement.requestPointerLock(); });
    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement === this.domElement) {
        document.addEventListener('mousemove', this._onMouseMove);
      } else {
        document.removeEventListener('mousemove', this._onMouseMove);
      }
    });

    // Keyboard
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);

    // Touch
    document.body.addEventListener('touchstart', this._onTouchStart, { passive: false });
    document.body.addEventListener('touchmove', this._onTouchMove, { passive: false });
    document.body.addEventListener('touchend', this._onTouchEnd);
  }

  _onMouseMove(e) {
    this.cameraGroup.rotation.y -= e.movementX * 0.0025;
    const newPitch = this.camera.rotation.x - e.movementY * 0.0025;
    this.camera.rotation.x = THREE.MathUtils.clamp(newPitch, -Math.PI/2, Math.PI/2);
  }

  _onKeyDown(e) {
    if (e.key === 'w') this.keys.forward = true;
    if (e.key === 's') this.keys.backward = true;
    if (e.key === 'a') this.keys.left = true;
    if (e.key === 'd') this.keys.right = true;
    if (e.key === ' ' && !this.isJumping) {
      this.isJumping = true;
      this.velocityY = this.jumpStrength;
    }
    if (e.key === 'r') this.isRunning = true;
  }

  _onKeyUp(e) {
    if (e.key === 'w') this.keys.forward = false;
    if (e.key === 's') this.keys.backward = false;
    if (e.key === 'a') this.keys.left = false;
    if (e.key === 'd') this.keys.right = false;
    if (e.key === 'r') this.isRunning = false;
  }

  _onTouchStart(e) {
    for (const touch of e.changedTouches) {
      const target = touch.target;
      if (target.closest('#joystick') && this.joystickTouchId === null) {
        this.joystickTouchId = touch.identifier;
        this.stick.style.transition = 'none';
      } else if (target.closest('#jumpBtn')) {
        if (!this.isJumping) { this.isJumping = true; this.velocityY = this.jumpStrength; }
      } else if (target.closest('#runBtn')) {
        if (this.runTouchId === null) { this.runTouchId = touch.identifier; this.isRunning = true; }
      } else if (this.dragTouchId === null) {
        this.dragTouchId = touch.identifier;
        this.prevX = touch.clientX; this.prevY = touch.clientY;
      }
    }
  }

  _onTouchMove(e) {
    for (const touch of e.changedTouches) {
      if (touch.identifier === this.joystickTouchId) {
        const rect = this.joystick.getBoundingClientRect();
        const x = touch.clientX - (rect.left + this.joystickRadius);
        const y = touch.clientY - (rect.top + this.joystickRadius);
        const dist = Math.min(this.joystickRadius, Math.hypot(x, y));
        const angle = Math.atan2(y, x);
        const stickX = dist * Math.cos(angle), stickY = dist * Math.sin(angle);
        this.stick.style.left = `${this.joystickRadius - 20 + stickX}px`;
        this.stick.style.top = `${this.joystickRadius - 20 + stickY}px`;
        this.joystickInput.x = stickX / this.joystickRadius;
        this.joystickInput.y = -stickY / this.joystickRadius;
      } else if (touch.identifier === this.dragTouchId) {
        const dx = touch.clientX - this.prevX, dy = touch.clientY - this.prevY;
        this.prevX = touch.clientX; this.prevY = touch.clientY;
        this.cameraGroup.rotation.y -= dx * 0.0025;
        const newPitch = this.camera.rotation.x - dy * 0.0025;
        this.camera.rotation.x = THREE.MathUtils.clamp(newPitch, -Math.PI/2, Math.PI/2);
      }
    }
  }

  _onTouchEnd(e) {
    for (const touch of e.changedTouches) {
      if (touch.identifier === this.joystickTouchId) {
        this.joystickTouchId = null;
        this.stick.style.transition = '0.2s';
        this.stick.style.left = '40px';
        this.stick.style.top = '40px';
        this.joystickInput.x = 0; this.joystickInput.y = 0;
      } else if (touch.identifier === this.dragTouchId) {
        this.dragTouchId = null;
      } else if (touch.identifier === this.runTouchId) {
        this.runTouchId = null;
        this.isRunning = false;
      }
    }
  }

  // ----------- Clean up listeners -----------
  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    document.body.removeEventListener('touchstart', this._onTouchStart);
    document.body.removeEventListener('touchmove', this._onTouchMove);
    document.body.removeEventListener('touchend', this._onTouchEnd);
    document.removeEventListener('mousemove', this._onMouseMove);
  }
}
