# Evermodel Ops
# Copyright (c) OpenSpug Organization. <spug.dev@gmail.com>
# Released under the AGPL-3.0 License.
import re


def verify_password(password):
    if len(password) < 8:
        return False
    if not all(map(lambda x: re.findall(x, password), ['[0-9]', '[a-z]', '[A-Z]'])):
        return False
    return True
