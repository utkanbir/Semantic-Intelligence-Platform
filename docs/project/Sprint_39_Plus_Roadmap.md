# SIP Sprint 39+ Roadmap — Kavramsal Model v2 / Backlog Hizalanması

**Rol:** Delivery Manager (PMO)
**Tarih:** 2026-07-12
**Durum:** Sprint 39 milestone + issue'lar oluşturuldu (2026-07-12) — Epic #396, milestone #42
**Dayanak:** Fable kod-vs-kontrat denetimi (HEAD `4a309f9`, Sprint 38 kapanmış), `SIP_Semantic_Transaction_Routing_Kavramsal_Model_v2` ve `SIP_User_Stories_Backlog` (final)
**Karar:** Extend (mevcut repo üzerine inşa) — bkz. denetim Bölüm B

---

## 0. Bu roadmap'in mantığı

Fable denetimi mevcut kodu (Sprint 38 sonrası) yeni finalize edilmiş kavramsal model ve backlog'a karşı satır satır kontrol etti. Bulgular üç katmanda gruplanıyor ve bu roadmap onları bu sırayla ele alıyor:

1. **Temel eksik** — §8 veri modelinin trx_main tarafı yarım (question/answer/duration/mode gibi birinci sınıf kolonlar yok). Her şey bunun üzerine kurulacağı için önce bu.
2. **Epic 10 (Ürünü Güçlendiren Beş Ek Yetenek)** — altyapısı kısmen hazır (özellikle 10.3/10.4), göreceli olarak ucuz ve yüksek görünürlüklü kazanımlar.
3. **Chat'in gerçek veriye inmesi** — denetimin en kritik bulgusu: bugünkü chat yalnızca ontoloji YAPISI üzerinden cevap veriyor, müşterinin gerçek verisine (KG sorgusu, Semantic Layer, DB'ye SQL) hiç inmiyor. §9.4'ün deterministik router'ı ve Compare Mode (Epic 4/5) bu olmadan anlamsız — bu yüzden Epic 10'dan hemen sonra geliyor, backlog sırasındaki numaraya göre değil, bağımlılığa göre.
4. **Sandbox kavramı ve eksik connector katmanları** — Business Glossary / Data Catalog / Semantic Layer bağlayıcıları ve "Sandbox" kavramsal yeniden adlandırması.
5. **Kalan Epic 7 parçaları ve küçük hikayeler.**

Toplam tahmin: **~14-18 sprint**, mevcut koda tam kredi verilerek. Aşağıdaki Sprint 39-42 tam detaylı (denetim bulgularından doğrudan türetildi); Sprint 43 ve sonrası epic-seviyesinde iskelet olarak veriliyor ve her biri başlamadan önce kendi mini-plan dokümanını alacak (Sprint 38'in kendisi de böyle başladı).

---

## Sprint 39 — §8 Veri Modeli Tamamlama

**Epic:** Temel (yeni — mevcut epic yapısına ait değil, altyapı sprinti)
**Neden ilk:** Sonraki her sprint (özellikle 10.3/10.4) bu kolonların üzerine yazılacak.

| ID | Başlık | Yüzey | Gate | Bağımlı |
|----|--------|-------|------|---------|
| S39-01 | `semantic_transactions` tablosuna `question_text`, `answer_text`, `started_at`, `completed_at`, `total_duration_ms`, `mode` kolonlarını ekleyen Alembic migration (nullable/default, mevcut satırlar bozulmadan) | Backend | Evet* | — |
| S39-02 | `TraceLayer` enum'unu §8.2'nin 6 katmanlı şemasıyla (Ontology / Knowledge Graph / Information / Data ayrımı dahil) hizala — mevcut 4 değeri kırmadan genişlet | Backend | Evet* | — |
| S39-03 | `ontology_chat_service.py`'yi yeni kolonlara yazacak şekilde güncelle (şu an question/answer yalnızca trace step'lerin input_summary/output_summary'sine 500 karakterle kırpılıyor — bu artık trx_main'in birinci sınıf alanı) | Backend | Hayır | S39-01 |
| S39-04 | Taksonomi/kontrat dokümanlarını yeni kolonlarla güncelle; contract-sync CI'nin yakalayacağı şekilde aynı PR'da | Docs | Hayır | S39-01 |
| S39-05 | Testler + sprint-close hijyeni | Backend | Hayır | S39-01..04 |

\* S39-01, S39-02: schema migration → mimari kapıya eskale.

**DoD:** Mevcut trace kayıtları bozulmadan, her yeni SemanticTransaction question/answer/duration/mode'u trx_main seviyesinde taşıyor; `verify_contract_sync.py` ve `verify_semantic_lineage_sync.py` yeşil.

---

## Sprint 40 — Maliyet Gözlemlenebilirliği + Çok Turlu Sohbet (US-10.3 + US-10.4)

**Epic:** 10 — Ürünü Güçlendiren Beş Ek Yetenek
**Neden burada:** Denetimde en hazır altyapıya sahip iki hikaye (`duration_ms` deseni zaten var, aynı desenle `cost_estimate` eklenebilir).

| ID | Başlık | Yüzey | Gate | Bağımlı |
|----|--------|-------|------|---------|
| S40-01 | `trace_steps`'e `cost_estimate` kolonu; `semantic_transactions`'a `total_cost_estimate` — migration | Backend | Evet* | S39-01 |
| S40-02 | LLM adaptöründe token sayımından maliyet hesaplama (§13.3'teki zengin/bare akış karşılaştırması); her adıma cost_estimate yazımı | Backend | Hayır | S40-01 |
| S40-03 | `conversations` tablosu + `semantic_transactions.conversation_id` (nullable, FK) — migration | Backend | Evet* | S39-01 |
| S40-04 | Takip sorusu algılama + önceki trx'in kavram çözümünü yeniden kullanma mantığı (§13.4 örneğindeki gibi) | Backend | Hayır | S40-03 |
| S40-05 | Frontend: maliyet dashboard'u (aylık toplam, zengin/bare karşılaştırma) + chat panelinde konuşma iş parçacığı görünümü | Frontend | Hayır | S40-02, S40-04 |
| S40-06 | Testler + kontrat/taksonomi güncellemesi + sprint-close hijyeni | Backend/Frontend/Docs | Hayır | S40-01..05 |

\* S40-01, S40-03: schema migration → mimari kapıya eskale.

**DoD:** Her SemanticTransaction gerçek bir cost_estimate taşıyor; takip soruları önceki konuşmaya `conversation_id` ile bağlanıyor ve kavram çözümünü yeniden kullanıyor; dashboard canlı veriyle çalışıyor.

---

## Sprint 41 — Cevap Denetim Sertifikası + Geri Bildirim Döngüsü (US-10.2 + US-10.5)

**Epic:** 10
**Neden burada:** İkisi de mevcut trace kaydından türetilen dar dikeyler — Sprint 39-40'ın üzerine ek şema gerektirmeden bina edilebilir.

| ID | Başlık | Yüzey | Gate | Bağımlı |
|----|--------|-------|------|---------|
| S41-01 | Sertifika üretim mantığı: trx_main + ilgili trace adımlarından bütünlük imzası (hash) üreten servis | Backend | Evet* | S39-01 |
| S41-02 | Sertifika export endpoint'i (PDF/JSON) | Backend | Hayır | S41-01 |
| S41-03 | `answer_feedback` tablosu (trx_id, doğru/yanlış, not) — migration | Backend | Evet* | S39-01 |
| S41-04 | Geri bildirim kaydı endpoint'i + Sandbox Yöneticisi'nde "Geri Bildirim Kuyruğu" listesi | Backend/Frontend | Hayır | S41-03 |
| S41-05 | Frontend: sertifika görüntüleme/indirme ekranı + chat'te Doğru/Yanlış butonları | Frontend | Hayır | S41-02, S41-04 |
| S41-06 | Testler + sprint-close hijyeni | — | Hayır | S41-01..05 |

\* S41-01, S41-03: yeni imza mekanizması ve yeni tablo → mimari kapıya eskale.

**DoD:** Her cevap için indirilebilir bir denetim sertifikası üretilebiliyor; kullanıcı geri bildirimi kaydediliyor ve Sandbox Yöneticisi tarafında görünür.

---

## Sprint 42 — Discover Concepts (US-10.1)

**Epic:** 10
**Neden burada:** Epic 10'un geri kalanı bittikten sonra; sihirbazın mevcut aday-onay akışı (`GeneratedCandidateReview.tsx`) yeniden kullanılabilir ama yeni kaynak türü (kullanım logları/SQL sorgu geçmişi) ve örüntü çıkarımı S38 ölçeğinde yeni iş.

| ID | Başlık | Yüzey | Gate | Bağımlı |
|----|--------|-------|------|---------|
| S42-01 | Yeni kaynak türü: "Kullanım Logları" (SQL sorgu geçmişi / trace kayıtları üzerinden örüntü çıkarımı) | Backend | Evet* | — |
| S42-02 | Örüntüden aday kavram çıkarımı + kaynak rozetlemesi (mevcut extraction.py deseni genişletilerek) | Backend | Hayır | S42-01 |
| S42-03 | Frontend: mevcut `GeneratedCandidateReview.tsx` akışına yeni kaynak türünü ve "yeni kaynak" rozetini entegre et | Frontend | Hayır | S42-02 |
| S42-04 | Testler + sprint-close hijyeni | — | Hayır | S42-01..03 |

\* S42-01: yeni bir extraction kaynağı sınıfı → mimari kapıya eskale.

**DoD:** Kullanım loglarından çıkan aday kavramlar mevcut onay ekranında, kaynağı açıkça etiketlenmiş şekilde görünüyor ve onaylananlar ontolojiye materialize edilebiliyor.

---

## Sprint 43-46 — Deterministik Router + Gerçek Veriye İniş (kritik yol)

**Kapsam (epik seviye, detaylandırılacak):** §9.4'ün deterministik router'ı, context bundle üretimi, ve chat'in ontoloji yapısından öteye geçip gerçek KG sorgusu / Semantic Layer / DB'ye SQL üretip çalıştırması (bare path dahil). Bu, denetimin "chat şu an sadece ontoloji yapısı üzerinden cevap veriyor, iş verisine hiç inmiyor" bulgusunun karşılığı ve Compare Mode'un (Sprint 47-49) ön koşulu.

**Tahmin:** 3-4 sprint. **Not:** Bu blok başlamadan önce kendi Sprint 43 planı (S38 formatında) yazılmalı — burada iskelet olarak bırakılıyor çünkü şu anki denetim bunun kapsamını "yok" olarak işaretledi, detaylı hikaye kırılımı için ayrı bir keşif gerekiyor.

---

## Sprint 47-49 — Compare Mode (Epic 4)

**Kapsam:** Bare path (SQL ajanı) + zengin path karşılaştırması, `Comparison` kaydı, `match_status`, `AnswerCompared` trace adımı. Sprint 43-46'ya bağımlı (bare path olmadan karşılaştırılacak ikinci bir yol yok).

**Tahmin:** 2-3 sprint.

---

## Sprint 50 — Compare Dashboard (Epic 5)

**Kapsam:** Comparison kayıtlarının toplu görünümü, uyuşmazlık oranı metrikleri.
**Tahmin:** 1 sprint. Bağımlı: Sprint 47-49.

---

## Sprint 51-53 — Sandbox Kavramı + Eksik Connector Katmanları

**Kapsam:** "Sandbox" kavramsal yeniden adlandırması ve Aktif/Taslak yaşam döngüsü (US-1.1, US-6.1); Business Glossary, Data Catalog, Semantic Layer connector türleri (US-1.2 kapsamındaki eksik üç katman); sabit Read/Create rozetleri (US-1.4); MCP allowlist (US-1.5).

**Tahmin:** 2-3 sprint.

---

## Sprint 54-55 — Epic 7 Tamamlama + Kalan Küçük Hikayeler

**Kapsam:** Zamanlanmış AgentRun çalıştırma (US-7.4), şablon App'ler (US-8.1/8.2), Kademe 3 ve Discover Connector'ın kalan parçaları (US-9.1/9.2).

**Tahmin:** 1-2 sprint.

---

## Özet tablo

| Blok | Sprint | Süre | Epic |
|---|---|---|---|
| §8 tamamlama | 39 | 1 | Temel |
| Maliyet + Çok turlu sohbet | 40 | 1 | 10 |
| Sertifika + Geri bildirim | 41 | 1 | 10 |
| Discover Concepts | 42 | 1 | 10 |
| Router + gerçek veriye iniş | 43-46 | 3-4 | Yeni (kritik yol) |
| Compare Mode | 47-49 | 2-3 | 4 |
| Compare Dashboard | 50 | 1 | 5 |
| Sandbox + connector katmanları | 51-53 | 2-3 | 1 |
| Epic 7 tamamlama + kalanlar | 54-55 | 1-2 | 7, 8, 9 |
| **Toplam** | **39-55** | **~14-18 sprint** | |

## Sıradaki adım

Sprint 39 hazır — plan yeterince detaylı, doğrudan başlanabilir. Sprint 43 ve sonrası için, sırası geldiğinde Sprint 38'in kendi planı gibi ayrı bir keşif + mini-plan dokümanı üretilmeli (özellikle router/context-bundle işi, kapsamı şu an denetimden değil varsayımdan geliyor).
