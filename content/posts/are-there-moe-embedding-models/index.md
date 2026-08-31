---
title: "Are there MoE embedding models?"
date: 2026-08-30T23:54:41-05:00
draft: false
slug: are-there-moe-embedding-models
---

Yes, for example `nomic-ai/nomic-embed-text-v2-moe`. 但是这个路数是少数派。LLM 生成是逐 token 的算力/带宽瓶颈，MoE 收益巨大；embedding 是一次前向出一个向量，本来就便宜。MoE 的红利要在参数规模大、算力受限时才显现。embedding 模型主流在 0.1B 到 8B，这个区间 dense 训练稳、部署简单，没必要搞混合专家了。
