/**
 * Evermodel Ops
 * Copyright (c) OpenSpug Organization. <spug.dev@gmail.com>
 * Released under the AGPL-3.0 License.
 */
import React, { useState, useEffect } from 'react';
import { Modal, Dropdown } from 'antd';
import {
  CopyrightOutlined,
  GlobalOutlined,
  EyeOutlined,
  EyeInvisibleOutlined
} from '@ant-design/icons';
import styles from './login.module.css';
import AnimatedCharacters from './characters';
import history from 'libs/history';
import { http, initToken, t, langMode, setLanguage } from 'libs';
import logo from 'layout/logo-evermodel-txt.png';
import execStore from 'pages/exec/task/store';
import hostStore from 'pages/host/store';

export default function () {
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusField, setFocusField] = useState('none');
  const [error, setError] = useState('');
  const [errorField, setErrorField] = useState('');
  // 每次登录失败 +1，动画角色据此播放一次「沮丧 + 摇头」
  const [errorSeq, setErrorSeq] = useState(0);

  useEffect(() => {
    hostStore.rawRecords = [];
    execStore.hosts = [];
  }, [])

  function fail(message, field) {
    setError(message);
    setErrorField(field || 'password');
    setErrorSeq(seq => seq + 1);
  }

  function handleSubmit() {
    if (loading) return;
    if (!username.trim()) return fail(t('请输入账户'), 'username');
    if (!password) return fail(t('请输入密码'), 'password');

    setLoading(true);
    setError('');
    http.post('/api/account/login/', {username: username.trim(), password, type: 'default'})
      .then(data => {
        if (!data['has_real_ip']) {
          Modal.warning({
            title: t('安全警告'),
            className: styles.tips,
            content: t('未能获取到访问者的真实IP，无法提供基于请求来源IP的合法性验证。'),
            onOk: () => doLogin(data)
          })
        } else {
          doLogin(data)
        }
      })
      .catch(err => {
        setLoading(false);
        fail(typeof err === 'string' && err ? err : t('登录失败，请稍后重试'));
      })
  }

  function doLogin(data) {
    localStorage.setItem('id', data['id']);
    localStorage.setItem('token', data['access_token']);
    localStorage.setItem('nickname', data['nickname']);
    initToken();
    if (history.location.state && history.location.state['from']) {
      history.push(history.location.state['from'])
    } else {
      history.push('/host')
    }
  }

  const languageMenu = {
    selectedKeys: [langMode],
    items: [
      {key: 'zh', label: '简体中文', onClick: () => setLanguage('zh')},
      {key: 'en', label: 'English', onClick: () => setLanguage('en')}
    ]
  };

  const copyright = (
    <span>Copyright <CopyrightOutlined/> {new Date().getFullYear()} By Evermodel</span>
  );

  return (
    <div className={styles.page}>
      <div className={styles.left}>
        <div className={styles.brandBlock}>
          <div className={styles.brand}>
            <img className={styles.brandLogo} src={logo} alt="logo"/>
            <span>Evermodel Ops</span>
          </div>
          <div className={styles.tagline}>{t('灵活、强大、易用的开源运维平台')}</div>
        </div>

        <div className={styles.sceneWrap}>
          <AnimatedCharacters
            focusField={focusField}
            passwordVisible={showPassword}
            passwordLength={password.length}
            errorSeq={errorSeq}/>
        </div>

        <div className={styles.leftFooter}>{copyright}</div>
      </div>

      <div className={styles.right}>
        <div className={styles.language}>
          <Dropdown menu={languageMenu} placement="bottomRight">
            <div style={{cursor: 'pointer', fontSize: 14, padding: 6}}>
              <GlobalOutlined style={{marginRight: 4}}/>{langMode === 'zh' ? '简体中文' : 'English'}
            </div>
          </Dropdown>
        </div>

        <div className={styles.formWrap}>
          <div className={styles.mobileBrand}>
            <img src={logo} alt="logo"/>
            <span>Evermodel Ops</span>
          </div>

          <div className={styles.sparkle}>
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L13.5 9H10.5L12 2Z" fill="#1a1a2e"/>
              <path d="M12 22L10.5 15H13.5L12 22Z" fill="#1a1a2e"/>
              <path d="M2 12L9 10.5V13.5L2 12Z" fill="#1a1a2e"/>
              <path d="M22 12L15 13.5V10.5L22 12Z" fill="#1a1a2e"/>
            </svg>
          </div>

          <div className={styles.header}>
            <h1>{t('欢迎回来')}</h1>
            <p>{t('请输入账户信息以继续')}</p>
          </div>

          <form onSubmit={e => {e.preventDefault(); handleSubmit()}}>
            <div className={styles.field}>
              <label
                className={`${styles.label}${errorField === 'username' && error ? ` ${styles.labelError}` : ''}`}>
                {t('账户')}
              </label>
              <input
                className={`${styles.input}${errorField === 'username' && error ? ` ${styles.inputError}` : ''}`}
                value={username}
                placeholder={t('请输入账户')}
                autoComplete="off"
                onFocus={() => setFocusField('username')}
                onBlur={() => setFocusField('none')}
                onChange={e => {
                  setUsername(e.target.value);
                  setError('');
                }}/>
            </div>

            <div className={styles.field}>
              <label
                className={`${styles.label}${errorField === 'password' && error ? ` ${styles.labelError}` : ''}`}>
                {t('密码')}
              </label>
              <div className={styles.inputWrapper}>
                <input
                  className={`${styles.input}${errorField === 'password' && error ? ` ${styles.inputError}` : ''}`}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  placeholder={t('请输入密码')}
                  autoComplete="off"
                  onFocus={() => setFocusField('password')}
                  onBlur={() => setFocusField('none')}
                  onChange={e => {
                    setPassword(e.target.value);
                    setError('');
                  }}/>
                <button
                  type="button"
                  className={styles.togglePassword}
                  onClick={() => setShowPassword(v => !v)}>
                  {showPassword ? <EyeOutlined/> : <EyeInvisibleOutlined/>}
                </button>
              </div>
            </div>

            {error ? <div className={styles.errorMsg}>{error}</div> : null}

            <button type="submit" className={styles.button} disabled={loading}>
              <span className={styles.btnText}>{loading ? t('登录中...') : t('登录')}</span>
              {!loading && (
                <span className={styles.btnHoverContent}>
                  <span>{t('登录')}</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"/>
                    <polyline points="12 5 19 12 12 19"/>
                  </svg>
                </span>
              )}
            </button>
          </form>

          <div className={styles.mobileFooter}>{copyright}</div>
        </div>
      </div>
    </div>
  )
}
