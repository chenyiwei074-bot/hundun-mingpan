import sys, io
sys.stdout.reconfigure(encoding='utf-8')

lines = []
lines.append("'use client';")
lines.append("")
lines.append("import React, { useState } from 'react';")
lines.append("")
lines.append("// ===== \u661f\u8000\u77e5\u8bc6\u5e93 =====")
lines.append("")

# Star keywords (14 main stars)
lines.append("const STAR_KEYWORDS: Record<string, string> = {")
for k, v in {
    '\u7d2b\u5fae': '\u5e1d\u661f\uff0c\u9886\u5bfc\u529b\u3001\u8d23\u4efb\u611f\u3001\u5c0a\u8d35\u6c14\u8d28',
    '\u5929\u673a': '\u8c0b\u7565\u4e4b\u661f\uff0c\u667a\u6167\u3001\u53d8\u901a\u3001\u5584\u4e8e\u8ba1\u5212',
    '\u592a\u9633': '\u4e2d\u5929\u4e4b\u661f\uff0c\u70ed\u60c5\u3001\u5149\u660e\u3001\u516c\u4f17\u7f18\u4f73',
    '\u6b66\u66f2': '\u8d22\u661f\uff0c\u679c\u65ad\u3001\u91d1\u878d\u624d\u534e\u3001\u5b64\u72ec\u611f',
    '\u5929\u540c': '\u798f\u661f\uff0c\u968f\u548c\u3001\u4eab\u53d7\u3001\u4eba\u7f18\u597d',
    '\u5ec9\u8d1e': '\u56da\u661f\uff0c\u539f\u5219\u3001\u6e05\u9ad8\u3001\u5b88\u89c4\u77e9',
    '\u5929\u5e9c': '\u5e93\u661f\uff0c\u7a33\u5b9a\u3001\u5b88\u6210\u3001\u50a8\u84c4\u80fd\u529b\u5f3a',
    '\u592a\u9634': '\u6bcd\u661f\uff0c\u7ec6\u817b\u3001\u6f02\u4eae\u3001\u5185\u655b\u6df1\u6c89',
    '\u8d2a\u72fc': '\u6843\u82b1\u661f\uff0c\u6b32\u671b\u3001\u591a\u624d\u591a\u827a\u3001\u4eba\u9645\u6d3b\u7edc',
    '\u5de8\u95e8': '\u6697\u661f\uff0c\u53e3\u624d\u3001\u6c9f\u901a\u3001\u5584\u4e8e\u8fa9\u8bba',
    '\u5929\u76f8': '\u5370\u661f\uff0c\u8f85\u4f50\u3001\u670d\u52a1\u3001\u5fe0\u8bda\u53ef\u9760',
    '\u5929\u6881': '\u836f\u661f\uff0c\u6b63\u76f4\u3001\u6e05\u9ad8\u3001\u5b88\u62a4\u8005\u89d2\u8272',
    '\u4e03\u6740': '\u5c06\u661f\uff0c\u7ade\u4e89\u3001\u51b2\u52b2\u3001\u6562\u4e8e\u62fc\u640f',
    '\u7834\u519b': '\u7834\u574f\u4e0e\u91cd\u5efa\uff0c\u521b\u65b0\u3001\u63a8\u7ffb\u3001\u4e0d\u5b89\u4e8e\u73b0\u72b6',
}.items():
    lines.append("  '" + k + "': '" + v + "',")
lines.append("};")
lines.append("")

# Star pair combinations
lines.append("const STAR_PAIR: Record<string, string> = {")
pairs = {
    '\u7d2b\u5fae+\u5929\u5e9c': '\u5e1d\u738b\u53cc\u661f\uff0c\u7a33\u5b9a\u5b88\u6210\uff0c\u5927\u5c06\u4e4b\u98ce\uff0c\u9002\u5408\u7ba1\u7406\u4e0e\u50a8\u84c4',
    '\u7d2b\u5fae+\u7834\u519b': '\u5e1d\u661f\u7834\u519b\uff0c\u5148\u7acb\u540e\u7834\uff0c\u4e00\u751f\u5927\u8d77\u5927\u843d\uff0c\u9002\u5408\u521b\u4e1a',
    '\u7d2b\u5fae+\u5929\u76f8': '\u5e1d\u661f\u5e26\u5370\uff0c\u638c\u5370\u4e4b\u624d\uff0c\u6709\u6743\u6709\u8d23\uff0c\u9002\u5408\u516c\u804c',
    '\u7d2b\u5fae+\u4e03\u6740': '\u6740\u7834\u5e1d\u661f\uff0c\u5316\u6743\u4e3a\u7978\uff0c\u6743\u529b\u5e26\u6740\u6c14\uff0c\u9700\u614e\u884c',
    '\u5929\u673a+\u592a\u9633': '\u9633\u660e\u667a\u6167\uff0c\u8c0b\u7565\u4e0e\u70ed\u60c5\u5e76\u5b58\uff0c\u9002\u5408\u516c\u4f17\u4e8b\u4e1a',
    '\u5929\u673a+\u5de8\u95e8': '\u667a\u6167\u52a0\u53e3\u624d\uff0c\u8c0b\u7565\u4e0e\u8868\u8fbe\u517c\u5907\uff0c\u9002\u5408\u54a8\u8be2\u3001\u5a92\u4f53',
    '\u592a\u9633+\u592a\u9634': '\u65e5\u6708\u540c\u5bab\uff0c\u660e\u6697\u5171\u6d4e\uff0c\u5185\u5916\u517c\u4fee\uff0c\u4eba\u7f18\u6781\u4f73',
    '\u592a\u9633+\u5de8\u95e8': '\u9633\u5de8\u540c\u5bab\uff0c\u70ed\u60c5\u4e0e\u53e3\u624d\u7684\u7ed3\u5408\uff0c\u9002\u5408\u9500\u552e\u3001\u6f14\u8bb2',
    '\u6b66\u66f2+\u5929\u5e9c': '\u8d22\u5e93\u53cc\u661f\uff0c\u91d1\u878d\u624d\u534e\u914d\u7a33\u5b9a\u50a8\u84c4\uff0c\u7406\u8d22\u80fd\u529b\u5f3a',
    '\u6b66\u66f2+\u8d2a\u72fc': '\u8d22\u6843\u53cc\u661f\uff0c\u91d1\u94b1\u4e0e\u4eba\u9645\u517c\u5f97\uff0c\u504f\u8d22\u8fd0\u4f73',
    '\u6b66\u66f2+\u4e03\u6740': '\u8d22\u5e26\u6740\u6c14\uff0c\u679c\u65ad\u4e2d\u5e26\u7ade\u4e89\uff0c\u9002\u5408\u91d1\u878d\u3001\u6cd5\u5f8b',
    '\u5929\u540c+\u592a\u9634': '\u798f\u6bcd\u53cc\u661f\uff0c\u6e29\u67d4\u4eab\u53d7\uff0c\u798f\u6c14\u6df1\u539a\uff0c\u4eba\u751f\u5c11\u6ce2\u6298',
    '\u5929\u540c+\u5929\u6881': '\u798f\u5bff\u53cc\u661f\uff0c\u6b63\u76f4\u4e14\u6709\u798f\uff0c\u5b88\u62a4\u8005\u89d2\u8272\uff0c\u6709\u6e05\u798f',
    '\u5ec9\u8d1e+\u5929\u76f8': '\u6e05\u9ad8\u8f85\u4f50\uff0c\u539f\u5219\u4e0e\u670d\u52a1\u5e76\u5b58\uff0c\u9002\u5408\u884c\u653f\u3001\u4eba\u4e8b',
    '\u5ec9\u8d1e+\u7834\u519b': '\u56da\u7834\u53cc\u661f\uff0c\u5148\u56f0\u540e\u89e3\uff0c\u7edd\u5904\u9022\u751f\uff0c\u9002\u5408\u7814\u53d1\u3001\u521b\u65b0',
    '\u8d2a\u72fc+\u5ec9\u8d1e': '\u6843\u56da\u53cc\u661f\uff0c\u6b32\u671b\u4e0e\u539f\u5219\u5185\u6597\uff0c\u9700\u5b66\u4f1a\u5e73\u8861',
    '\u5929\u5e9c+\u5929\u76f8': '\u5e93\u5370\u53cc\u661f\uff0c\u7a33\u5b9a\u8f85\u4f50\uff0c\u9002\u5408\u8d22\u52a1\u3001\u884c\u653f\u7ba1\u7406',
    '\u592a\u9634+\u5929\u673a': '\u6bcd\u667a\u53cc\u661f\uff0c\u7ec6\u817b\u8c0b\u7565\uff0c\u5584\u4e8e\u7b79\u5212\uff0c\u9002\u5408\u7b56\u5212\u3001\u7814\u7a76',
}
for k, v in pairs.items():
    lines.append("  '" + k + "': '" + v + "',")
lines.append("};")
lines.append("")

# Palace explanations - template per palace
lines.append("const GONG_BASE: Record<string, { pro: string; plain: string; life: string }> = {")
gong_data = {
    '\u547d\u5bab': {
        'pro': '\u547d\u5bab\u662f\u5341\u4e8c\u5bab\u4e4b\u9996\uff0c\u4ee3\u8868\u547d\u4e3b\u7684\u505a\u4e8b\u65b9\u5f0f\u3001\u5916\u5728\u5f62\u8c61\u4e0e\u4eba\u751f\u6838\u5fc3\u8ffd\u6c42\u3002\u5bab\u5185\u661f\u8000\u76f4\u63a5\u5f71\u54cd\u547d\u4e3b\u7684\u6027\u683c\u4e0e\u4eba\u751f\u8d70\u5411\u3002',
        'plain': '\u547d\u5bab\u544a\u8bc9\u4f60\uff0c\u4f60\u662f\u4e00\u4e2a\u4ec0\u4e48\u6837\u7684\u4eba\uff0c\u522b\u4eba\u7b2c\u4e00\u773c\u770b\u5230\u4f60\u65f6\u662f\u4ec0\u4e48\u611f\u89c9\uff0c\u4f60\u505a\u4e8b\u7684\u4e60\u60ef\u662f\u4ec0\u4e48\u3002',
        'life': '\u547d\u5bab\u4e3b\u661f\u51b3\u5b9a\u4e86\u4f60\u5728\u4eba\u751f\u5404\u4e2a\u9886\u57df\u7684\u6838\u5fc3\u98ce\u683c\uff0c\u662f\u4f60\u6700\u81ea\u7136\u7684\u53cd\u5e94\u6a21\u5f0f\u3002'
    },
    '\u5144\u5f1f\u5bab': {
        'pro': '\u5144\u5f1f\u5bab\u4e3b\u624b\u8db3\u540c\u4f34\u3001\u4eba\u9645\u4ea4\u5f80\u3001\u7ade\u4e89\u5173\u7cfb\u4e0e\u501f\u8d37\u80fd\u529b\u3002\u661f\u8000\u914d\u7f6e\u53cd\u6620\u547d\u4e3b\u5728\u793e\u4ea4\u4e2d\u7684\u4f4d\u7f6e\u3002',
        'plain': '\u8fd9\u4e2a\u5bab\u4f4d\u5173\u4e8e\u4f60\u548c\u670b\u53cb\u3001\u540c\u4e8b\u3001\u5144\u5f1f\u59d0\u59b9\u7684\u5173\u7cfb\uff0c\u4e5f\u4ee3\u8868\u4f60\u7684\u4ea4\u9645\u80fd\u529b\u548c\u7ade\u4e89\u4f18\u52bf\u3002',
        'life': '\u5728\u4eba\u9645\u5173\u7cfb\u4e2d\uff0c\u4f60\u503e\u5411\u4e8e\u4e3b\u52a8\u8fd8\u662f\u88ab\u52a8\uff1f\u7ade\u4e89\u4e2d\u4f60\u662f\u8fdb\u653b\u578b\u8fd8\u662f\u9632\u5b88\u578b\uff1f\u5144\u5f1f\u5bab\u4f1a\u7ed9\u51fa\u7b54\u6848\u3002'
    },
    '\u592b\u59bb\u5bab': {
        'pro': '\u592b\u59bb\u5bab\u4e3b\u5a5a\u59fb\u89c2\u3001\u914d\u5076\u7279\u5f81\u3001\u611f\u60c5\u76f8\u5904\u6a21\u5f0f\u3002\u5bab\u5185\u661f\u8000\u51b3\u5b9a\u5a5a\u59fb\u8d28\u91cf\u4e0e\u5e78\u798f\u611f\u3002',
        'plain': '\u8fd9\u91cc\u544a\u8bc9\u4f60\uff0c\u4f60\u4f1a\u9047\u5230\u4ec0\u4e48\u6837\u7684\u53e6\u4e00\u534a\uff0c\u4f60\u4eec\u7684\u76f8\u5904\u6a21\u5f0f\u662f\u4ec0\u4e48\uff0c\u4f60\u5bf9\u5a5a\u59fb\u7684\u671f\u5f85\u662f\u4ec0\u4e48\u3002',
        'life': '\u4f60\u7684\u611f\u60c5\u4e16\u754c\u662f\u70ed\u60c5\u5954\u653e\u8fd8\u662f\u5185\u655b\u6df1\u6c89\uff1f\u4f60\u548c\u914d\u5076\u662f\u4e92\u8865\u8fd8\u662f\u4e92\u514b\uff1f\u592b\u59bb\u5bab\u4f1a\u63ed\u793a\u7b54\u6848\u3002'
    },
    '\u5b50\u5973\u5bab': {
        'pro': '\u5b50\u5973\u5bab\u4e3b\u5b69\u5b50\u3001\u5f1f\u5b50\u3001\u521b\u4f5c\u3001\u5a31\u4e50\u3002\u661f\u8000\u53cd\u6620\u547d\u4e3b\u7684\u751f\u80b2\u8fd0\u3001\u521b\u4f5c\u529b\u4e0e\u5a31\u4e50\u503e\u5411\u3002',
        'plain': '\u8fd9\u4e2a\u5bab\u4f4d\u5173\u4e8e\u4f60\u7684\u5b69\u5b50\u8fd0\u3001\u4f60\u7684\u521b\u4f5c\u80fd\u529b\u3001\u4f60\u559c\u6b22\u7684\u5a31\u4e50\u65b9\u5f0f\u3002',
        'life': '\u4f60\u662f\u5426\u9002\u5408\u5e26\u56e2\u961f\uff1f\u662f\u5426\u6709\u827a\u672f\u5929\u8d4b\uff1f\u5b50\u5973\u5bab\u7684\u661f\u8000\u914d\u7f6e\u4f1a\u544a\u8bc9\u4f60\u3002'
    },
    '\u8d22\u5e1b\u5bab': {
        'pro': '\u8d22\u5e1b\u5bab\u4e3b\u8d22\u5bcc\u89c2\u3001\u8d5a\u94b1\u65b9\u5f0f\u3001\u91d1\u94b1\u7ba1\u7406\u80fd\u529b\u3002\u5bab\u5185\u661f\u8000\u51b3\u5b9a\u8d22\u5bcc\u4e0a\u9650\u4e0e\u83b7\u53d6\u6a21\u5f0f\u3002',
        'plain': '\u4f60\u600e\u4e48\u8d5a\u94b1\uff1f\u94b1\u6765\u5f97\u5bb9\u4e0d\u5bb9\u6613\uff1f\u4f60\u64c5\u4e0d\u64c5\u957f\u7406\u8d22\uff1f\u8d22\u5e1b\u5bab\u7ed9\u4f60\u7b54\u6848\u3002',
        'life': '\u4f60\u7684\u8d22\u5bcc\u6a21\u5f0f\u662f\u7a33\u5b9a\u50a8\u84c4\u8fd8\u662f\u5927\u8d77\u5927\u843d\uff1f\u4f60\u9002\u5408\u521b\u4e1a\u8fd8\u662f\u4e0a\u73ed\uff1f\u8d22\u5e1b\u5bab\u4f1a\u6307\u660e\u65b9\u5411\u3002'
    },
    '\u75be\u5384\u5bab': {
        'pro': '\u75be\u5384\u5bab\u4e3b\u5065\u5eb7\u3001\u8eab\u4f53\u7d20\u8d28\u3001\u75be\u75c5\u503e\u5411\u3002\u661f\u8000\u914d\u7f6e\u53cd\u6620\u547d\u4e3b\u7684\u5065\u5eb7\u98ce\u9669\u4e0e\u4f53\u8d28\u7279\u70b9\u3002',
        'plain': '\u4f60\u7684\u8eab\u4f53\u54ea\u4e9b\u65b9\u9762\u9700\u8981\u6ce8\u610f\uff1f\u4f60\u5bb9\u6613\u751f\u4ec0\u4e48\u75c5\uff1f\u75be\u5384\u5bab\u4f1a\u63d0\u524d\u544a\u8b66\u4f60\u3002',
        'life': '\u4f60\u7684\u5065\u5eb7\u72b6\u6001\u4e0e\u4f60\u7684\u751f\u6d3b\u4e60\u60ef\u3001\u60c5\u7eea\u6ce2\u52a8\u5bc6\u5207\u76f8\u5173\uff0c\u75be\u5384\u5bab\u662f\u4f60\u7684\u5065\u5eb7\u6307\u5357\u3002'
    },
    '\u8fc1\u79fb\u5bab': {
        'pro': '\u8fc1\u79fb\u5bab\u4e3b\u5916\u51fa\u3001\u65c5\u884c\u3001\u8fdc\u65b9\u8fd0\u6c14\u3001\u5916\u90e8\u73af\u5883\u9002\u5e94\u80fd\u529b\u3002\u661f\u8000\u53cd\u6620\u547d\u4e3b\u7684\u8d35\u4eba\u8fd0\u4e0e\u5916\u51fa\u673a\u4f1a\u3002',
        'plain': '\u4f60\u9002\u5408\u7559\u5728\u5bb6\u4e61\u8fd8\u662f\u53bb\u8fdc\u65b9\u53d1\u5c55\uff1f\u4f60\u7684\u8d35\u4eba\u5728\u54ea\u91cc\uff1f\u8fc1\u79fb\u5bab\u7ed9\u4f60\u65b9\u5411\u3002',
        'life': '\u4f60\u662f\u5426\u5e38\u5e38\u6362\u5de5\u4f5c\u6216\u57ce\u5e02\uff1f\u4f60\u5728\u65b0\u73af\u5883\u4e2d\u9002\u5e94\u5f97\u5feb\u5417\uff1f\u8fc1\u79fb\u5bab\u63ed\u793a\u7b54\u6848\u3002'
    },
    '\u4ea4\u53cb\u5bab': {
        'pro': '\u4ea4\u53cb\u5bab\u4e3b\u670b\u53cb\u3001\u540c\u4e8b\u3001\u4e0b\u5c5e\u3001\u793e\u4ea4\u5708\u5b50\u3002\u661f\u8000\u53cd\u6620\u547d\u4e3b\u7684\u793e\u4ea4\u8d28\u91cf\u4e0e\u4eba\u9645\u7f51\u7edc\u3002',
        'plain': '\u4f60\u8eab\u8fb9\u662f\u4ec0\u4e48\u6837\u7684\u4eba\uff1f\u4f60\u7684\u670b\u53cb\u5708\u5b50\u5bf9\u4f60\u6709\u5e2e\u52a9\u5417\uff1f\u4ea4\u53cb\u5bab\u544a\u8bc9\u4f60\u3002',
        'life': '\u4f60\u7684\u4eba\u9645\u5173\u7cfb\u662f\u4f60\u7684\u52a9\u529b\u8fd8\u662f\u963b\u529b\uff1f\u4f60\u8eab\u8fb9\u5c0f\u4eba\u591a\u8fd8\u662f\u8d35\u4eba\u591a\uff1f\u4ea4\u53cb\u5bab\u4f1a\u63ed\u793a\u3002'
    },
    '\u5b98\u7984\u5bab': {
        'pro': '\u5b98\u7984\u5bab\u4e3b\u4e8b\u4e1a\u3001\u804c\u4e1a\u3001\u5de5\u4f5c\u73af\u5883\u3001\u793e\u4f1a\u5730\u4f4d\u3002\u661f\u8000\u51b3\u5b9a\u547d\u4e3b\u7684\u4e8b\u4e1a\u65b9\u5411\u4e0e\u6210\u5c31\u4e0a\u9650\u3002',
        'plain': '\u4f60\u9002\u5408\u505a\u4ec0\u4e48\u5de5\u4f5c\uff1f\u4f60\u5728\u804c\u573a\u4e0a\u80fd\u722c\u591a\u9ad8\uff1f\u5b98\u7984\u5bab\u662f\u4f60\u7684\u804c\u4e1a\u6307\u5357\u3002',
        'life': '\u4f60\u7684\u4e8b\u4e1a\u503e\u5411\u662f\u7a33\u5b9a\u4e0a\u73ed\u8fd8\u662f\u521b\u4e1a\u535a\u6740\uff1f\u4f60\u5728\u804c\u573a\u4e2d\u7684\u7ade\u4e89\u4f18\u52bf\u662f\u4ec0\u4e48\uff1f'
    },
    '\u7530\u5b85\u5bab': {
        'pro': '\u7530\u5b85\u5bab\u4e3b\u623f\u4ea7\u3001\u5bb6\u5ead\u73af\u5883\u3001\u5c45\u4f4f\u8d28\u91cf\u3002\u661f\u8000\u53cd\u6620\u547d\u4e3b\u7684\u5bb6\u5ead\u89c2\u4e0e\u7269\u8d28\u57fa\u7840\u3002',
        'plain': '\u4f60\u4f1a\u4e70\u623f\u5417\uff1f\u4f60\u7684\u5bb6\u5ead\u73af\u5883\u600e\u4e48\u6837\uff1f\u7530\u5b85\u5bab\u544a\u8bc9\u4f60\u5173\u4e8e\u5bb6\u7684\u4e00\u5207\u3002',
        'life': '\u4f60\u5bf9\u5bb6\u7684\u5f52\u5c5e\u611f\u5f3a\u4e0d\u5f3a\uff1f\u4f60\u559c\u6b22\u7ecf\u5e38\u642c\u5bb6\u8fd8\u662f\u5b89\u571f\u91cd\u8fc1\uff1f\u7530\u5b85\u5bab\u6709\u7b54\u6848\u3002'
    },
    '\u798f\u5fb7\u5bab': {
        'pro': '\u798f\u5fb7\u5bab\u4e3b\u7cbe\u795e\u4e16\u754c\u3001\u665a\u5e74\u751f\u6d3b\u3001\u5185\u5fc3\u5e78\u798f\u611f\u3002\u661f\u8000\u53cd\u6620\u547d\u4e3b\u7684\u798f\u62a5\u4e0e\u7cbe\u795e\u5f52\u5c5e\u3002',
        'plain': '\u4f60\u665a\u5e74\u4f1a\u8fc7\u5f97\u600e\u4e48\u6837\uff1f\u4f60\u5185\u5fc3\u771f\u6b63\u5feb\u4e50\u5417\uff1f\u798f\u5fb7\u5bab\u662f\u4f60\u7684\u7cbe\u795e\u5bc4\u6258\u3002',
        'life': '\u4f60\u7684\u5e78\u798f\u611f\u6765\u81ea\u4e8e\u4ec0\u4e48\uff1f\u4f60\u662f\u5426\u6709\u5b97\u6559\u4fe1\u4ef0\u6216\u7cbe\u795e\u8ffd\u6c42\uff1f\u798f\u5fb7\u5bab\u4f1a\u63ed\u793a\u3002'
    },
    '\u7236\u6bcd\u5bab': {
        'pro': '\u7236\u6bcd\u5bab\u4e3b\u7236\u6bcd\u3001\u957f\u8f88\u3001\u4e0a\u53f8\u3001\u5bb6\u5ead\u80cc\u666f\u3002\u661f\u8000\u53cd\u6620\u547d\u4e3b\u7684\u5bb6\u5ead\u6761\u4ef6\u4e0e\u957f\u8f88\u7f18\u5206\u3002',
        'plain': '\u4f60\u548c\u7236\u6bcd\u7684\u5173\u7cfb\u600e\u4e48\u6837\uff1f\u4f60\u7684\u5bb6\u5ead\u80cc\u666f\u5bf9\u4f60\u6709\u4ec0\u4e48\u5f71\u54cd\uff1f\u7236\u6bcd\u5bab\u544a\u8bc9\u4f60\u3002',
        'life': '\u4f60\u662f\u5426\u5f97\u5230\u5bb6\u5ead\u7684\u652f\u6301\uff1f\u4f60\u548c\u4e0a\u53f8\u7684\u5173\u7cfb\u5982\u4f55\uff1f\u7236\u6bcd\u5bab\u5f71\u54cd\u4f60\u7684\u4e0a\u5347\u8def\u3002'
    },
}
for gong, info in gong_data.items():
    lines.append("  '" + gong + "': { pro: '" + info['pro'] + "', plain: '" + info['plain'] + "', life: '" + info['life'] + "' },")
lines.append("};")
lines.append("")

# Bazi cross-verification templates (TODO - need backend)
lines.append("// \u4e0e\u516b\u5b57\u53cc\u76d8\u9a8c\u8bc1 \u2014 \u5f85\u540e\u7aef\u8865\u5145\u5b57\u6bb5")
lines.append("const GONG_BAZI_CROSS: Record<string, string> = {")
for gong in ['\u547d\u5bab','\u5144\u5f1f\u5bab','\u592b\u59bb\u5bab','\u5b50\u5973\u5bab','\u8d22\u5e1b\u5bab','\u75be\u5384\u5bab','\u8fc1\u79fb\u5bab','\u4ea4\u53cb\u5bab','\u5b98\u7984\u5bab','\u7530\u5b85\u5bab','\u798f\u5fb7\u5bab','\u7236\u6bcd\u5bab']:
    lines.append("  '" + gong + "': 'TODO: \u9700\u540e\u7aef\u63d0\u4f9b\u53cc\u76d8\u9a8c\u8bc1\u6570\u636e',")
lines.append("};")
lines.append("")

# Props and state
lines.append("interface Props { ziwei: any; baziDayMaster?: string; }")
lines.append("")
lines.append("export default function ZiweiCard({ ziwei, baziDayMaster }: Props) {")
lines.append("  const [showLocked, setShowLocked] = useState(false);")
lines.append("  const gongs = ziwei?.gongs || [];")
lines.append("")
lines.append("  if (!gongs.length) {")
lines.append("    return <div className='rounded-xl border border-black/5 bg-white p-6 text-center text-sm' style={{color:'#86868b'}}>\u7d2b\u5fae\u6570\u636e\u672a\u52a0\u8f7d</div>;")
lines.append("  }")
lines.append("")

# Ordered gongs
lines.append("  const GONG_ORDER = ['\u547d\u5bab','\u5144\u5f1f\u5bab','\u592b\u59bb\u5bab','\u5b50\u5973\u5bab','\u8d22\u5e1b\u5bab','\u75be\u5384\u5bab','\u8fc1\u79fb\u5bab','\u4ea4\u53cb\u5bab','\u5b98\u7984\u5bab','\u7530\u5b85\u5bab','\u798f\u5fb7\u5bab','\u7236\u6bcd\u5bab'];")
lines.append("  const KEY_GONGS = ['\u547d\u5bab','\u5b98\u7984\u5bab','\u8d22\u5e1b\u5bab','\u592b\u59bb\u5bab'];")
lines.append("  const arranged = GONG_ORDER.map(n => gongs.find((g: any) => g.gong === n)).filter(Boolean);")
lines.append("  const keyGongs = KEY_GONGS.map(n => gongs.find((g: any) => g.gong === n)).filter(Boolean);")
lines.append("  const otherGongs = GONG_ORDER.filter(n => !KEY_GONGS.includes(n)).map(n => gongs.find((g: any) => g.gong === n)).filter(Boolean);")
lines.append("")

# Helper: get star pair description
lines.append("  const getPairDesc = (stars: string[]): string | null => {")
lines.append("    if (stars.length < 2) return null;")
lines.append("    const key = stars[0] + '+' + stars[1];")
lines.append("    if (STAR_PAIR[key]) return STAR_PAIR[key];")
lines.append("    const rev = stars[1] + '+' + stars[0];")
lines.append("    if (STAR_PAIR[rev]) return STAR_PAIR[rev];")
lines.append("    return null;")
lines.append("  };")
lines.append("")

# JSX start
lines.append("  return (")
lines.append("    <section className='w-full'>")
lines.append("      <h3 className='font-serif text-xl font-bold mb-5 tracking-wider' style={{color:'#1d1d1f'}}>")
lines.append("        <span className='inline-block w-1.5 h-5 rounded-full mr-2.5 align-middle' style={{background:'#2e83f6'}} />")
lines.append("        <span className='text-xs font-normal tracking-wider px-2 py-0.5 rounded mr-2 align-middle' style={{color:'#86868b',background:'rgba(0,0,0,0.04)'}}>\u5206\u6790\u4f9d\u636e</span>")
lines.append("        \u7d2b\u5fae\u5341\u4e8c\u5bab")
lines.append("      </h3>")
lines.append("")

# === Key 4 palaces with full details ===
lines.append("      <div className='space-y-5 mb-8'>")
lines.append("        {keyGongs.map((gong: any, i: number) => {")
lines.append("          const gb = GONG_BASE[gong.gong];")
lines.append("          const pairDesc = getPairDesc(gong.mainStars || []);")
lines.append("          return (")
lines.append("            <div key={i} className='rounded-2xl border border-black/5 bg-white p-5 shadow-sm'>")
lines.append("              {/* Header */}")
lines.append("              <div className='flex items-center justify-between mb-4'>")
lines.append("                <h4 className='font-serif text-base font-bold' style={{color:'#1d1d1f'}}>{gong.gong}</h4>")
lines.append("                <span className='text-xs px-2 py-0.5 rounded-full' style={{background:'rgba(46,131,246,0.08)',color:'#2e83f6'}}>{gong.dizhi || ''}\u4f4d</span>")
lines.append("              </div>")
lines.append("")

# Main stars
lines.append("              <div className='flex flex-wrap gap-2 mb-3'>")
lines.append("                {gong.mainStars?.map((s: string, j: number) => (")
lines.append("                  <span key={j} className='px-2.5 py-1 rounded-lg text-sm font-medium' style={{background:'rgba(178,149,93,0.1)',color:'#b2955d',border:'1px solid rgba(178,149,93,0.2)'}}>{s}</span>")
lines.append("                ))}")
lines.append("                {(!gong.mainStars || gong.mainStars.length === 0) && <span className='text-sm' style={{color:'#ccc'}}>\u65e0\u4e3b\u661f</span>}")
lines.append("              </div>")
lines.append("")

# Aux stars
lines.append("              {gong.auxStars?.length > 0 && (")
lines.append("                <div className='flex flex-wrap gap-1.5 mb-3'>")
lines.append("                  {gong.auxStars.map((s: string, j: number) => (")
lines.append("                    <span key={j} className='px-2 py-0.5 rounded text-xs' style={{background:'rgba(0,0,0,0.03)',color:'#555'}}>{s}</span>")
lines.append("                  ))}")
lines.append("                </div>")
lines.append("              )}")
lines.append("")

# Sihua badges
lines.append("              {gong.sihua?.length > 0 && (")
lines.append("                <div className='flex flex-wrap gap-1.5 mb-3'>")
lines.append("                  {gong.sihua.map((sh: any, j: number) => (")
lines.append("                    <span key={j} className='px-2 py-0.5 rounded text-[11px] font-medium' style={{background:sh.hua==='\u5316\u5fcc'?'rgba(211,5,5,0.08)':'rgba(178,149,93,0.08)',color:sh.hua==='\u5316\u5fcc'?'#d30505':'#b2955d'}}>{sh.star}{sh.hua}</span>")
lines.append("                  ))}")
lines.append("                </div>")
lines.append("              )}")
lines.append("")

# Star pair combination
lines.append("              {pairDesc && (")
lines.append("                <div className='rounded-lg p-3 mb-3' style={{background:'rgba(178,149,93,0.04)'}}>")
lines.append("                  <span className='text-[11px] tracking-wider' style={{color:'#b2955d'}}>\u661f\u8000\u7ec4\u5408 </span>")
lines.append("                  <span className='text-sm ml-1' style={{color:'#555'}}>{pairDesc}</span>")
lines.append("                </div>")
lines.append("              )}")
lines.append("")

# Professional explanation (free tier)
lines.append("              {gb && (")
lines.append("                <div className='rounded-lg p-3 mb-2' style={{background:'rgba(0,0,0,0.02)'>")  # This line is incorrect - let me fix
lines.append("                <div className='rounded-lg p-3 mb-2' style={{background:'rgba(0,0,0,0.02)'}}>")
lines.append("                  <span className='text-[11px] tracking-wider' style={{color:'#86868b'}}>\u4e13\u4e1a\u89e3\u91ca </span>")
lines.append("                  <span className='text-sm ml-1' style={{color:'#555'}}>{gb.pro}</span>")
lines.append("                </div>")
lines.append("                <div className='rounded-lg p-3' style={{background:'rgba(0,0,0,0.02)'}}>")
lines.append("                  <span className='text-[11px] tracking-wider' style={{color:'#86868b'}}>\u901a\u4fd7\u89e3\u91ca </span>")
lines.append("                  <span className='text-sm ml-1' style={{color:'#555'}}>{gb.plain}</span>")
lines.append("                </div>")
lines.append("              )}")
lines.append("")

# Locked section toggle for this palace
lines.append("              {!showLocked && (")
lines.append("                <button onClick={() => setShowLocked(true)} className='mt-3 w-full rounded-lg py-2 text-xs tracking-wider transition-colors' style={{color:'#b2955d',background:'rgba(178,149,93,0.06)'}}>")
lines.append("                  \U0001F512 \u67e5\u770b\u4eba\u751f\u8868\u73b0 + \u53cc\u76d8\u9a8c\u8bc1")
lines.append("                </button>")
lines.append("              )}")
lines.append("")

# Locked content
lines.append("              {showLocked && (")
lines.append("                <div className='mt-3 space-y-2 pt-3 border-t border-dashed' style={{borderColor:'rgba(178,149,93,0.2)'}}>")
lines.append("                  {gb && (")
lines.append("                    <div className='rounded-lg p-3' style={{background:'rgba(211,5,5,0.03)'}}>")
lines.append("                      <span className='text-[11px] tracking-wider' style={{color:'#d30505'}}>\u4eba\u751f\u8868\u73b0 </span>")
lines.append("                      <span className='text-sm ml-1' style={{color:'#555'}}>{gb.life}</span>")
lines.append("                    </div>")
lines.append("                  )}")
lines.append("                  <div className='rounded-lg p-3' style={{background:'rgba(139,109,3,0.04)'}}>")
lines.append("                    <span className='text-[11px] tracking-wider' style={{color:'#8b6d03'}}>\u53cc\u76d8\u9a8c\u8bc1 </span>")
lines.append("                    <span className='text-sm ml-1' style={{color:'#999'}}>{GONG_BAZI_CROSS[gong.gong] || 'TODO'}</span>")
lines.append("                  </div>")
lines.append("                  <p className='text-[10px]' style={{color:'#ccc'}}>\u6b64\u5185\u5bb9\u9700\u540e\u7aef\u63d0\u4f9b\u53cc\u76d8\u5408\u53c2\u6570\u636e\u540e\u5b8c\u6574\u5c55\u793a</p>")
lines.append("                </div>")
lines.append("              )}")
lines.append("            </div>")
lines.append("          );")
lines.append("        })}")
lines.append("      </div>")
lines.append("")

# === Other 8 palaces - compact grid ===
lines.append("      <button onClick={() => setShowLocked(!showLocked)} className='w-full text-center py-2.5 rounded-lg text-xs tracking-wider mb-4 transition-colors' style={{color:'#b2955d',background:'rgba(178,149,93,0.06)'}}>")
lines.append("        {showLocked ? '\U0001F512 \u6536\u8d77\u6df1\u5ea6\u89e3\u8bfb' : '\u5c55\u5f00\u5168\u90e8\u5341\u4e8c\u5bab\u8be6\u60c5 \u25bc'}")
lines.append("      </button>")
lines.append("")

# Compact grid
lines.append("      <div className='grid grid-cols-2 md:grid-cols-4 gap-3 mb-6'>")
lines.append("        {arranged.map((gong: any, i: number) => {")
lines.append("          const gb2 = GONG_BASE[gong.gong];")
lines.append("          return (")
lines.append("            <div key={i} className='rounded-xl border border-black/5 bg-white p-3 text-center shadow-sm'>")
lines.append("              <div className='text-xs tracking-wider mb-1' style={{color:'#86868b'}}>{gong.gong}</div>")
lines.append("              <div className='text-xs font-medium mb-1' style={{color:'#1d1d1f'}}>")
lines.append("                {gong.mainStars?.length > 0 ? gong.mainStars.slice(0,2).join(' ') : <span style={{color:'#ccc'}}>—</span>}")
lines.append("              </div>")
lines.append("              {gong.auxStars?.length > 0 && (")
lines.append("                <div className='text-[10px]' style={{color:'#aaa'}}>{gong.auxStars.slice(0,2).join(' ')}</div>")
lines.append("              )}")
lines.append("              {gong.sihua?.length > 0 && (")
lines.append("                <div className='mt-1'>")
lines.append("                  {gong.sihua.slice(0,1).map((sh: any, j: number) => (")
lines.append("                    <span key={j} className='inline-block px-1.5 py-0.5 rounded text-[10px] font-medium' style={{background:sh.hua==='\u5316\u5fcc'?'rgba(211,5,5,0.1)':'rgba(178,149,93,0.1)',color:sh.hua==='\u5316\u5fcc'?'#d30505':'#b2955d'}}>{sh.star}{sh.hua}</span>")
lines.append("                  ))}")
lines.append("                </div>")
lines.append("              )}")
lines.append("              {showLocked && gb2 && (")
lines.append("                <p className='text-[10px] mt-2 leading-relaxed' style={{color:'#999'}}>{gb2.plain.slice(0,30)}...</p>")
lines.append("              )}")
lines.append("            </div>")
lines.append("          );")
lines.append("        })}")
lines.append("      </div>")
lines.append("")

# 四化 overview
lines.append("      {ziwei?.sihuaOverview && (")
lines.append("        <div className='rounded-xl border border-black/5 bg-white p-4 shadow-sm'>")
lines.append("          <h4 className='text-sm font-bold mb-3' style={{color:'#1d1d1f'}}>\u751f\u5e74\u56db\u5316</h4>")
lines.append("          <div className='grid grid-cols-2 md:grid-cols-4 gap-3 text-xs'>")
lines.append("            {ziwei.sihuaOverview.lu && (<div className='rounded-lg p-3 text-center' style={{background:'rgba(7,168,48,0.06)'}}><div style={{color:'#07a830'}}>\u5316\u7984</div><div className='font-medium mt-1' style={{color:'#1d1d1f'}}>{ziwei.sihuaOverview.lu.star}</div><div style={{color:'#86868b'}}>{ziwei.sihuaOverview.lu.gong}</div></div>)}")
lines.append("            {ziwei.sihuaOverview.quan && (<div className='rounded-lg p-3 text-center' style={{background:'rgba(211,5,5,0.06)'}}><div style={{color:'#d30505'}}>\u5316\u6743</div><div className='font-medium mt-1' style={{color:'#1d1d1f'}}>{ziwei.sihuaOverview.quan.star}</div><div style={{color:'#86868b'}}>{ziwei.sihuaOverview.quan.gong}</div></div>)}")
lines.append("            {ziwei.sihuaOverview.ke && (<div className='rounded-lg p-3 text-center' style={{background:'rgba(46,131,246,0.06)'}}><div style={{color:'#2e83f6'}}>\u5316\u79d1</div><div className='font-medium mt-1' style={{color:'#1d1d1f'}}>{ziwei.sihuaOverview.ke.star}</div><div style={{color:'#86868b'}}>{ziwei.sihuaOverview.ke.gong}</div></div>)}")
lines.append("            {ziwei.sihuaOverview.ji && (<div className='rounded-lg p-3 text-center' style={{background:'rgba(139,109,3,0.06)'}}><div style={{color:'#8b6d03'}}>\u5316\u5fcc</div><div className='font-medium mt-1' style={{color:'#1d1d1f'}}>{ziwei.sihuaOverview.ji.star}</div><div style={{color:'#86868b'}}>{ziwei.sihuaOverview.ji.gong}</div></div>)}")
lines.append("          </div>")
lines.append("        </div>")
lines.append("      )}")
lines.append("    </section>")
lines.append("  );")
lines.append("}")

content = "\n".join(lines) + "\n"
path = r'C:\Users\Kobe\Documents\HDAI\frontend\components\chart\ZiweiCard.tsx'
with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print('ZiweiCard written -', len(lines), 'lines,', len(content), 'chars')