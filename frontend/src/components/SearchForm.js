/**
 * Evermodel Ops
 * Copyright (c) OpenSpug Organization. <spug.dev@gmail.com>
 * Released under the AGPL-3.0 License.
 */
import React from 'react';
import { Row, Col, Form } from 'antd';
import styles from './index.module.less';

export default class extends React.Component {
  static Item(props) {
    return (
      <Col span={props.span} offset={props.offset} style={props.style}>
        <Form.Item label={props.title}>
          {props.children}
        </Form.Item>
      </Col>
    )
  }

  render() {
    // gutter 可选：筛选条件少时默认的 48 会让各项之间显得空旷，页面可按需收紧。
    // 无论取值多少，Row 的负边距与 Col 的内边距会相互抵消，首/末项始终与卡片 24px 内边距对齐。
    const gutter = this.props.gutter === undefined ? {md: 8, lg: 24, xl: 48} : this.props.gutter;
    return (
      <div className={styles.searchForm} style={this.props.style}>
        <Form style={this.props.style}>
          <Row gutter={gutter}>
            {this.props.children}
          </Row>
        </Form>
      </div>
    )
  }
}
