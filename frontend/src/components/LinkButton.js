/**
 * Evermodel Ops
 * Copyright (c) OpenSpug Organization. <spug.dev@gmail.com>
 * Released under the AGPL-3.0 License.
 */
import React from 'react';
import { Button } from 'antd';


export default function LinkButton(props) {
  return <Button {...props} type="link" style={{padding: 0}}>
    {props.children}
  </Button>
}
