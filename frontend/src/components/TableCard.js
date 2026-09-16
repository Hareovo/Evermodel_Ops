import React, { useState, useEffect, useRef } from 'react';
import { Table, Space, Divider, Popover, Checkbox, Button, Input, Select } from 'antd';
import { ReloadOutlined, SettingOutlined, FullscreenOutlined, SearchOutlined } from '@ant-design/icons';
import { t } from 'libs';
import styles from './index.module.less';

const STORAGE_KEY = 'TableFields';
const STORAGE_VERSION = 2;
function readStorage() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed.version === STORAGE_VERSION ? parsed.data || {} : {};
    }
  } catch (e) { /* ignore unavailable or malformed storage */ }
  return {};
}
function writeStorage(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({version: STORAGE_VERSION, data})); } catch (e) { /* ignore */ }
}
let TableFields = readStorage();

function Search(props) {
  let keys = props.keys || ['']; keys = keys.map(x => x.split('/'));
  const [key, setKey] = useState(keys[0][0]);
  return <Input allowClear style={{width: '280px'}} placeholder={t('输入检索')} prefix={<SearchOutlined style={{color: '#c0c0c0'}}/>}
    onChange={e => props.onChange(key, e.target.value)} addonBefore={<Select value={key} onChange={setKey}>{keys.map(item => <Select.Option key={item[0]} value={item[0]}>{item[1]}</Select.Option>)}</Select>}/>;
}
function Footer(props) {
  const length = props.selected.length;
  return length > 0 ? <div className={styles.tableFooter}><div className={styles.left}>{t('已选择')} <span>{length}</span> {t('项')}</div><Space size="middle">{(props.actions || []).map((item, index) => <React.Fragment key={index}>{item}</React.Fragment>)}</Space></div> : null;
}
function Header(props) {
  const columns = props.columns || [], fields = props.fields || [];
  const handleCheckAll = e => props.onFieldsChange(e.target.checked ? columns.map((_, i) => i) : []);
  return <div className={styles.toolbar}><div className={styles.title}>{props.title}</div><div className={styles.option}><Space size="middle" style={{marginRight: 10}}>{(props.actions || []).map((item, i) => <React.Fragment key={i}>{item}</React.Fragment>)}</Space>{props.actions && props.actions.length ? <Divider type="vertical"/> : null}<Space className={styles.icons}><ReloadOutlined onClick={props.onReload}/><Popover arrowPointAtCenter destroyTooltipOnHide={{keepParent: false}} title={[<Checkbox key="all" checked={fields.length === columns.length} indeterminate={fields.length > 0 && fields.length < columns.length} onChange={handleCheckAll}>{t('列展示')}</Checkbox>, <Button key="reset" type="link" style={{padding: 0}} onClick={() => props.onFieldsChange(props.defaultFields)}>{t('重置')}</Button>]} overlayClassName={styles.tableFields} trigger="click" placement="bottomRight" content={<Checkbox.Group value={fields} onChange={props.onFieldsChange}>{columns.map((item, i) => <Checkbox value={i} key={item.key}>{item.title}</Checkbox>)}</Checkbox.Group>}><SettingOutlined/></Popover><FullscreenOutlined onClick={() => { if (props.rootRef.current && document.fullscreenEnabled) document.fullscreenElement ? document.exitFullscreen() : props.rootRef.current.requestFullscreen(); }}/></Space></div></div>;
}

function TableCard(props) {
  const rootRef = useRef(), selected = props.selected || [];
  const [fields, setFields] = useState([]), [defaultFields, setDefaultFields] = useState([]), [columns, setColumns] = useState([]);
  useEffect(() => {
    let raw = props.children ? React.Children.toArray(props.children).map(x => x && x.props).filter(Boolean) : (props.columns || []);
    const cols = raw.map((column, index) => ({...column, key: column.key || column.dataIndex || `column-${index}`}));
    const defaults = cols.map((_, i) => i).filter(i => !cols[i].hide);
    let hidden = props.tKey && TableFields[props.tKey];
    if (!Array.isArray(hidden)) {
      hidden = cols.filter(c => c.hide).map((c, i) => c.title || c.dataIndex || c.key || `column-${i}`);
      if (props.tKey) { TableFields[props.tKey] = hidden; writeStorage(TableFields); }
    }
    const visible = cols.map((c, i) => i).filter(i => !hidden.includes(cols[i].title) && !hidden.includes(cols[i].dataIndex) && !hidden.includes(cols[i].key));
    setColumns(cols); setFields(visible); setDefaultFields(defaults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function handleFieldsChange(next) {
    setFields(next);
    if (props.tKey) { TableFields[props.tKey] = columns.filter((_, i) => !next.includes(i)).map((c, i) => c.dataIndex || c.key || c.title || `column-${i}`); writeStorage(TableFields); }
  }
  return <div ref={rootRef} className={styles.tableCard}><Header title={props.title} columns={columns} actions={props.actions} fields={fields} rootRef={rootRef} defaultFields={defaultFields} onFieldsChange={handleFieldsChange} onReload={props.onReload}/><Table tableLayout={props.tableLayout} scroll={props.scroll} rowKey={props.rowKey} loading={props.loading} columns={columns.filter((_, i) => fields.includes(i))} dataSource={props.dataSource} rowSelection={props.rowSelection} expandable={props.expandable} pagination={props.pagination}/>{selected.length ? <Footer selected={selected} actions={props.batchActions}/> : null}</div>;
}
TableCard.Search = Search;
export { readStorage, writeStorage };
export default TableCard;
