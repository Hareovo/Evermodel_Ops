/**
 * Evermodel Ops
 * Copyright (c) OpenSpug Organization. <spug.dev@gmail.com>
 * Released under the AGPL-3.0 License.
 *
 * 登录页左侧的交互动画角色。
 * 由纯 CSS 图形构成（无图片、无第三方依赖），眼睛跟随鼠标，并对
 * 输入焦点、密码可见性、登录失败做出反应。
 * 动画设计参考自开源项目 animatedlogin。
 */
import React, { useEffect, useRef } from 'react';
import styles from './login.module.css';

// 各角色瞳孔跟随鼠标时的最大位移
const PUPIL_RANGE = { purple: 5, black: 4, orange: 5, yellow: 5 };
// 登录失败时需要摇头的部位
const SHAKE_KEYS = ['purpleEyes', 'blackEyes', 'orangeEyes', 'yellowEyes', 'yellowMouth', 'orangeMouth'];
// 眨眼间隔
const BLINK_MIN = 3000;
const BLINK_MAX = 7000;
const BLINK_DURATION = 150;

export default function AnimatedCharacters(props) {
  const { errorSeq } = props;
  const sceneRef = useRef(null);
  const nodes = useRef({});

  // 供 mousemove / 定时器等异步回调读取最新 props
  const propsRef = useRef(props);
  propsRef.current = props;

  const stRef = useRef({
    mouseX: 0,
    mouseY: 0,
    lookAtEachOther: false, // 输入账户时四目相对（短暂）
    blink: { purple: false, black: false },
    peek: false, // 密码明文时紫色角色偷看
    error: false
  });

  // 每次渲染都会重新赋值，异步回调总能拿到最新的状态
  const update = useRef(() => {});
  update.current = () => {
    const n = nodes.current;
    if (!n.purple) return;

    const { mouseX, mouseY } = stRef.current;
    const focus = propsRef.current.focusField;
    const showPassword = propsRef.current.passwordVisible;
    const passwordLength = propsRef.current.passwordLength;

    const isTyping = focus === 'username';
    const isLookingAway = focus === 'password' && !showPassword;
    const isShowingPwd = passwordLength > 0 && showPassword;
    const isError = stRef.current.error;

    // 依据元素位置和鼠标位置计算面部偏移与身体倾斜
    const calcPosition = el => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 3;
      const dx = mouseX - cx;
      const dy = mouseY - cy;
      return {
        faceX: Math.max(-15, Math.min(15, dx / 20)),
        faceY: Math.max(-10, Math.min(10, dy / 30)),
        bodySkew: Math.max(-6, Math.min(6, -dx / 120))
      };
    };

    // 瞳孔朝鼠标方向移动，最远不超过 maxDist
    const calcPupil = (el, maxDist) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = mouseX - cx;
      const dy = mouseY - cy;
      const dist = Math.min(Math.sqrt(dx * dx + dy * dy), maxDist);
      const angle = Math.atan2(dy, dx);
      return `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist}px)`;
    };

    const purplePos = calcPosition(n.purple);
    const blackPos = calcPosition(n.black);
    const orangePos = calcPosition(n.orange);
    const yellowPos = calcPosition(n.yellow);

    // ---- 紫色角色 ----
    if (isShowingPwd) {
      n.purple.style.transform = 'skewX(0deg)';
      n.purple.style.height = '370px';
    } else if (isLookingAway) {
      n.purple.style.transform = 'skewX(-14deg) translateX(-20px)';
      n.purple.style.height = '410px';
    } else if (isTyping) {
      n.purple.style.transform = `skewX(${(purplePos.bodySkew || 0) - 12}deg) translateX(40px)`;
      n.purple.style.height = '410px';
    } else {
      n.purple.style.transform = `skewX(${purplePos.bodySkew}deg)`;
      n.purple.style.height = '370px';
    }

    n.purpleEyeL.style.height = stRef.current.blink.purple ? '2px' : '18px';
    n.purpleEyeR.style.height = stRef.current.blink.purple ? '2px' : '18px';

    if (isError) {
      n.purpleEyes.style.left = '30px';
      n.purpleEyes.style.top = '55px';
      n.purplePupilL.style.transform = 'translate(-3px, 4px)';
      n.purplePupilR.style.transform = 'translate(-3px, 4px)';
    } else if (isLookingAway) {
      n.purpleEyes.style.left = '20px';
      n.purpleEyes.style.top = '25px';
      n.purplePupilL.style.transform = 'translate(-5px, -5px)';
      n.purplePupilR.style.transform = 'translate(-5px, -5px)';
    } else if (isShowingPwd) {
      n.purpleEyes.style.left = '20px';
      n.purpleEyes.style.top = '35px';
      const px = stRef.current.peek ? 4 : -4;
      const py = stRef.current.peek ? 5 : -4;
      n.purplePupilL.style.transform = `translate(${px}px, ${py}px)`;
      n.purplePupilR.style.transform = `translate(${px}px, ${py}px)`;
    } else if (stRef.current.lookAtEachOther) {
      n.purpleEyes.style.left = '55px';
      n.purpleEyes.style.top = '65px';
      n.purplePupilL.style.transform = 'translate(3px, 4px)';
      n.purplePupilR.style.transform = 'translate(3px, 4px)';
    } else {
      n.purpleEyes.style.left = 45 + purplePos.faceX + 'px';
      n.purpleEyes.style.top = 40 + purplePos.faceY + 'px';
      const pupil = calcPupil(n.purpleEyeL, PUPIL_RANGE.purple);
      n.purplePupilL.style.transform = pupil;
      n.purplePupilR.style.transform = pupil;
    }

    // ---- 黑色角色 ----
    if (isShowingPwd) {
      n.black.style.transform = 'skewX(0deg)';
    } else if (isLookingAway) {
      n.black.style.transform = 'skewX(12deg) translateX(-10px)';
    } else if (stRef.current.lookAtEachOther) {
      n.black.style.transform = `skewX(${(blackPos.bodySkew || 0) * 1.5 + 10}deg) translateX(20px)`;
    } else if (isTyping) {
      n.black.style.transform = `skewX(${(blackPos.bodySkew || 0) * 1.5}deg)`;
    } else {
      n.black.style.transform = `skewX(${blackPos.bodySkew}deg)`;
    }

    n.blackEyeL.style.height = stRef.current.blink.black ? '2px' : '16px';
    n.blackEyeR.style.height = stRef.current.blink.black ? '2px' : '16px';

    if (isError) {
      n.blackEyes.style.left = '15px';
      n.blackEyes.style.top = '40px';
      n.blackPupilL.style.transform = 'translate(-3px, 4px)';
      n.blackPupilR.style.transform = 'translate(-3px, 4px)';
    } else if (isLookingAway) {
      n.blackEyes.style.left = '10px';
      n.blackEyes.style.top = '20px';
      n.blackPupilL.style.transform = 'translate(-4px, -5px)';
      n.blackPupilR.style.transform = 'translate(-4px, -5px)';
    } else if (isShowingPwd) {
      n.blackEyes.style.left = '10px';
      n.blackEyes.style.top = '28px';
      n.blackPupilL.style.transform = 'translate(-4px, -4px)';
      n.blackPupilR.style.transform = 'translate(-4px, -4px)';
    } else if (stRef.current.lookAtEachOther) {
      n.blackEyes.style.left = '32px';
      n.blackEyes.style.top = '12px';
      n.blackPupilL.style.transform = 'translate(0px, -4px)';
      n.blackPupilR.style.transform = 'translate(0px, -4px)';
    } else {
      n.blackEyes.style.left = 26 + blackPos.faceX + 'px';
      n.blackEyes.style.top = 32 + blackPos.faceY + 'px';
      const pupil = calcPupil(n.blackEyeL, PUPIL_RANGE.black);
      n.blackPupilL.style.transform = pupil;
      n.blackPupilR.style.transform = pupil;
    }

    // ---- 橙色角色 ----
    if (isError) {
      n.orangeMouth.style.left = 80 + orangePos.faceX + 'px';
      n.orangeMouth.style.top = '130px';
    }
    n.orange.style.transform = isShowingPwd ? 'skewX(0deg)' : `skewX(${orangePos.bodySkew}deg)`;

    if (isError) {
      n.orangeEyes.style.left = '60px';
      n.orangeEyes.style.top = '95px';
      n.orangePupilL.style.transform = 'translate(-3px, 4px)';
      n.orangePupilR.style.transform = 'translate(-3px, 4px)';
    } else if (isLookingAway) {
      n.orangeEyes.style.left = '50px';
      n.orangeEyes.style.top = '75px';
      n.orangePupilL.style.transform = 'translate(-5px, -5px)';
      n.orangePupilR.style.transform = 'translate(-5px, -5px)';
    } else if (isShowingPwd) {
      n.orangeEyes.style.left = '50px';
      n.orangeEyes.style.top = '85px';
      n.orangePupilL.style.transform = 'translate(-5px, -4px)';
      n.orangePupilR.style.transform = 'translate(-5px, -4px)';
    } else {
      n.orangeEyes.style.left = 82 + orangePos.faceX + 'px';
      n.orangeEyes.style.top = 90 + orangePos.faceY + 'px';
      const pupil = calcPupil(n.orangePupilL, PUPIL_RANGE.orange);
      n.orangePupilL.style.transform = pupil;
      n.orangePupilR.style.transform = pupil;
    }

    // ---- 黄色角色 ----
    n.yellow.style.transform = isShowingPwd ? 'skewX(0deg)' : `skewX(${yellowPos.bodySkew}deg)`;

    if (isError) {
      n.yellowEyes.style.left = '35px';
      n.yellowEyes.style.top = '45px';
      n.yellowPupilL.style.transform = 'translate(-3px, 4px)';
      n.yellowPupilR.style.transform = 'translate(-3px, 4px)';
      n.yellowMouth.style.left = '30px';
      n.yellowMouth.style.top = '92px';
      n.yellowMouth.style.transform = 'rotate(-8deg)';
    } else if (isLookingAway) {
      n.yellowEyes.style.left = '20px';
      n.yellowEyes.style.top = '30px';
      n.yellowPupilL.style.transform = 'translate(-5px, -5px)';
      n.yellowPupilR.style.transform = 'translate(-5px, -5px)';
      n.yellowMouth.style.left = '15px';
      n.yellowMouth.style.top = '78px';
      n.yellowMouth.style.transform = 'rotate(0deg)';
    } else if (isShowingPwd) {
      n.yellowEyes.style.left = '20px';
      n.yellowEyes.style.top = '35px';
      n.yellowPupilL.style.transform = 'translate(-5px, -4px)';
      n.yellowPupilR.style.transform = 'translate(-5px, -4px)';
      n.yellowMouth.style.left = '10px';
      n.yellowMouth.style.top = '88px';
      n.yellowMouth.style.transform = 'rotate(0deg)';
    } else {
      n.yellowEyes.style.left = 52 + yellowPos.faceX + 'px';
      n.yellowEyes.style.top = 40 + yellowPos.faceY + 'px';
      const pupil = calcPupil(n.yellowPupilL, PUPIL_RANGE.yellow);
      n.yellowPupilL.style.transform = pupil;
      n.yellowPupilR.style.transform = pupil;
      n.yellowMouth.style.left = 40 + yellowPos.faceX + 'px';
      n.yellowMouth.style.top = 88 + yellowPos.faceY + 'px';
      n.yellowMouth.style.transform = 'rotate(0deg)';
    }
  };

  // 收集 DOM 节点
  useEffect(() => {
    const map = {};
    sceneRef.current.querySelectorAll('[data-el]').forEach(el => {
      map[el.dataset.el] = el;
    });
    nodes.current = map;
    update.current();
  }, []);

  // 鼠标跟随
  useEffect(() => {
    const onMove = e => {
      stRef.current.mouseX = e.clientX;
      stRef.current.mouseY = e.clientY;
      if (!stRef.current.error) update.current();
    };
    document.addEventListener('mousemove', onMove);
    return () => document.removeEventListener('mousemove', onMove);
  }, []);

  // 随机眨眼
  useEffect(() => {
    const timers = {};
    const schedule = key => {
      const delay = Math.random() * (BLINK_MAX - BLINK_MIN) + BLINK_MIN;
      timers[`${key}Open`] = setTimeout(() => {
        stRef.current.blink[key] = true;
        update.current();
        timers[`${key}Close`] = setTimeout(() => {
          stRef.current.blink[key] = false;
          update.current();
          schedule(key);
        }, BLINK_DURATION);
      }, delay);
    };
    schedule('purple');
    schedule('black');
    return () => Object.values(timers).forEach(clearTimeout);
  }, []);

  // 输入账户时四目相对（仅持续 800ms）
  const focusField = props.focusField;
  useEffect(() => {
    if (focusField !== 'username') {
      stRef.current.lookAtEachOther = false;
      update.current();
      return;
    }
    stRef.current.lookAtEachOther = true;
    update.current();
    const timer = setTimeout(() => {
      stRef.current.lookAtEachOther = false;
      update.current();
    }, 800);
    return () => clearTimeout(timer);
  }, [focusField]);

  // 密码以明文显示时，紫色角色偶尔偷看
  const peeking = props.passwordVisible && props.passwordLength > 0;
  useEffect(() => {
    if (!peeking) {
      stRef.current.peek = false;
      update.current();
      return;
    }
    let cancelled = false;
    let outer, inner;
    const loop = () => {
      outer = setTimeout(() => {
        if (cancelled) return;
        stRef.current.peek = true;
        update.current();
        inner = setTimeout(() => {
          if (cancelled) return;
          stRef.current.peek = false;
          update.current();
          loop();
        }, 800);
      }, Math.random() * 3000 + 2000);
    };
    loop();
    return () => {
      cancelled = true;
      clearTimeout(outer);
      clearTimeout(inner);
    };
  }, [peeking]);

  // 登录失败：沮丧表情 + 摇头，2.5s 后自动恢复
  useEffect(() => {
    if (!errorSeq) return;
    const shakeEls = SHAKE_KEYS.map(key => nodes.current[key]).filter(Boolean);
    shakeEls.forEach(el => el.classList.remove(styles.shakeHead));
    // 触发 reflow，保证连续点击时动画能重新播放
    void document.body.offsetHeight;

    stRef.current.error = true;
    stRef.current.lookAtEachOther = false;
    update.current();
    nodes.current.orangeMouth.classList.add(styles.orangeMouthVisible);

    const shakeTimer = setTimeout(() => {
      shakeEls.forEach(el => el.classList.add(styles.shakeHead));
    }, 350);
    const recoverTimer = setTimeout(() => {
      stRef.current.error = false;
      shakeEls.forEach(el => el.classList.remove(styles.shakeHead));
      nodes.current.orangeMouth.classList.remove(styles.orangeMouthVisible);
      update.current();
    }, 2500);

    return () => {
      clearTimeout(shakeTimer);
      clearTimeout(recoverTimer);
      shakeEls.forEach(el => el.classList.remove(styles.shakeHead));
      if (nodes.current.orangeMouth) {
        nodes.current.orangeMouth.classList.remove(styles.orangeMouthVisible);
      }
    };
  }, [errorSeq]);

  return (
    <div className={styles.scene} ref={sceneRef}>
      <div className={`${styles.character} ${styles.purple}`} data-el="purple">
        <div className={`${styles.eyes} ${styles.purpleEyes}`} data-el="purpleEyes">
          <div className={`${styles.eyeball} ${styles.purpleEye}`} data-el="purpleEyeL">
            <div className={`${styles.pupil} ${styles.purplePupil}`} data-el="purplePupilL"/>
          </div>
          <div className={`${styles.eyeball} ${styles.purpleEye}`} data-el="purpleEyeR">
            <div className={`${styles.pupil} ${styles.purplePupil}`} data-el="purplePupilR"/>
          </div>
        </div>
      </div>

      <div className={`${styles.character} ${styles.black}`} data-el="black">
        <div className={`${styles.eyes} ${styles.blackEyes}`} data-el="blackEyes">
          <div className={`${styles.eyeball} ${styles.blackEye}`} data-el="blackEyeL">
            <div className={`${styles.pupil} ${styles.blackPupil}`} data-el="blackPupilL"/>
          </div>
          <div className={`${styles.eyeball} ${styles.blackEye}`} data-el="blackEyeR">
            <div className={`${styles.pupil} ${styles.blackPupil}`} data-el="blackPupilR"/>
          </div>
        </div>
      </div>

      <div className={`${styles.character} ${styles.orange}`} data-el="orange">
        <div className={`${styles.eyes} ${styles.orangeEyes}`} data-el="orangeEyes">
          <div className={styles.barePupil} data-el="orangePupilL"/>
          <div className={styles.barePupil} data-el="orangePupilR"/>
        </div>
        <div className={styles.orangeMouth} data-el="orangeMouth"/>
      </div>

      <div className={`${styles.character} ${styles.yellow}`} data-el="yellow">
        <div className={`${styles.eyes} ${styles.yellowEyes}`} data-el="yellowEyes">
          <div className={styles.barePupil} data-el="yellowPupilL"/>
          <div className={styles.barePupil} data-el="yellowPupilR"/>
        </div>
        <div className={styles.yellowMouth} data-el="yellowMouth"/>
      </div>
    </div>
  );
}
