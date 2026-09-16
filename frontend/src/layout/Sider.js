import React, { useState, useEffect, useRef } from 'react';
import { Layout, Menu } from 'antd';
import { useLocation } from 'react-router-dom';
import { history } from 'libs';
import styles from './layout.module.less';
import routes from '../routes';
import logo from './logo-evermodel-white.png';

function routePath(item) {
  if (item.path) return item.path;
  if (item.child && item.child.length) {
    const parts = item.child[0].path.split('/');
    return `/${parts[1]}`;
  }
  return undefined;
}

const OpenKeysMap = {};
for (const item of routes) {
  if (item.child) {
    const parentPath = routePath(item);
    for (const sub of item.child) if (sub.title && parentPath) OpenKeysMap[sub.path] = parentPath;
  }
}

function findOpenKey(pathname) {
  const matches = Object.keys(OpenKeysMap)
    .filter(path => pathname === path || pathname.startsWith(`${path}/`))
    .sort((a, b) => b.length - a.length);
  return matches.length ? OpenKeysMap[matches[0]] : undefined;
}

export default function Sider(props) {
  const [openKeys, setOpenKeys] = useState([]);
  const [menus, setMenus] = useState([]);
  const location = useLocation();
  const previousPath = useRef(location.pathname);

  useEffect(() => {
    const handleRoute = item => {
      if (!item.title) return null;
      const menu = {label: item.title, key: item.path || routePath(item), icon: item.icon};
      if (item.child) menu.children = item.child.map(handleRoute).filter(Boolean);
      return menu;
    };
    setMenus(routes.map(handleRoute).filter(Boolean));
  }, []);

  const openKey = findOpenKey(location.pathname);
  useEffect(() => {
    const pathChanged = previousPath.current !== location.pathname;
    previousPath.current = location.pathname;
    if (pathChanged && !props.collapsed && openKey) {
      setOpenKeys(keys => keys.includes(openKey) ? keys : [...keys, openKey]);
    }
  }, [location.pathname, openKey, props.collapsed]);

  return (
    <Layout.Sider width={208} collapsed={props.collapsed} className={styles.sider}>
      <div className={styles.logo}><img src={logo} alt="Logo"/>{!props.collapsed && <span className={styles.logoText}>Evermodel Ops</span>}</div>
      <div className={styles.menus} style={{height: `${document.body.clientHeight - 64}px`}}>
        <Menu theme="dark" mode="inline" items={menus} className={styles.menus}
          selectedKeys={[location.pathname]} openKeys={openKeys} onOpenChange={setOpenKeys}
          onSelect={menu => history.push(menu.key)}/>
      </div>
    </Layout.Sider>
  );
}

export { OpenKeysMap, findOpenKey };
