/**
 * Evermodel Ops
 * Copyright (c) OpenSpug Organization. <spug.dev@gmail.com>
 * Released under the AGPL-3.0 License.
 */
import React from 'react';
import {Card } from 'antd';
import { t } from 'libs';

export default function (props) {
  return (
    <Card>
      <div>{t('{}, 欢迎你', t(localStorage.getItem('nickname')))}</div>
    </Card>
  )
}
