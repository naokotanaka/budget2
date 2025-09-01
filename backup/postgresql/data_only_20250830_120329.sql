--
-- PostgreSQL database dump
--

-- Dumped from database version 16.9 (Ubuntu 16.9-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.9 (Ubuntu 16.9-0ubuntu0.24.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: grants; Type: TABLE DATA; Schema: public; Owner: nagaiku_user
--

COPY public.grants (id, name, "grantCode", "totalAmount", "startDate", "endDate", status, "createdAt", "updatedAt") FROM stdin;
1	WAM補	250403_WAMG_WAM補	7000000	2025-04-01 00:00:00	2026-03-31 00:00:00	active	2025-08-12 16:58:28.66	2025-08-12 16:58:28.66
2	つながり10	250413_愛知募金_つながり10月	305127	2025-04-01 00:00:00	2025-07-31 00:00:00	completed	2025-08-12 16:58:28.666	2025-08-12 16:58:28.666
3	むす春	250412_むすびえ_春募集	60000	2025-04-01 00:00:00	2025-05-31 00:00:00	completed	2025-08-12 16:58:28.676	2025-08-12 16:58:28.676
6	日本財団	250616_日本財団_寄付支援	470000	2025-07-22 00:00:00	2026-06-30 00:00:00	active	2025-08-12 16:58:28.688	2025-08-12 16:58:28.688
7	日財終了分	\N	396469	2025-04-01 00:00:00	2025-06-30 00:00:00	applied	2025-08-12 16:58:28.69	2025-08-12 16:58:28.69
9	POPOLO	250765_POPO_ひとり親	3000000	2025-07-28 00:00:00	2026-01-07 00:00:00	active	2025-08-12 16:58:28.694	2025-08-12 16:58:28.694
\.


--
-- Data for Name: budget_items; Type: TABLE DATA; Schema: public; Owner: nagaiku_user
--

COPY public.budget_items (id, name, category, "budgetedAmount", note, "grantId", "createdAt", "updatedAt", "sortOrder") FROM stdin;
9	印刷製本費	固定	39200	\N	1	2025-08-12 16:58:28.699	2025-08-12 16:58:28.699	9
10	家賃	家賃	1141200	\N	1	2025-08-12 16:58:28.703	2025-08-12 16:58:28.703	10
12	雑役務費	ほか	12000	\N	1	2025-08-12 16:58:28.708	2025-08-12 16:58:28.708	12
14	消耗品費	消耗・食材	508000	\N	1	2025-08-12 16:58:28.714	2025-08-12 16:58:28.714	14
15	賃金（アルバイト）	賃金	2382600	\N	1	2025-08-12 16:58:28.717	2025-08-12 16:58:28.717	15
16	賃金（職員）	賃金	1920000	\N	1	2025-08-12 16:58:28.72	2025-08-12 16:58:28.72	16
17	通信運搬費	通信	498000	\N	1	2025-08-12 16:58:28.722	2025-08-12 16:58:28.722	17
18	保険料	保険	25000	\N	1	2025-08-12 16:58:28.725	2025-08-12 16:58:28.725	18
19	食材費	食材	216000	\N	2	2025-08-12 16:58:28.728	2025-08-12 16:58:28.728	19
20	消耗品費	消耗	89127	\N	2	2025-08-12 16:58:28.73	2025-08-12 16:58:28.73	20
21	食品購入費	食材	48000	\N	3	2025-08-12 16:58:28.733	2025-08-12 16:58:28.733	21
22	消耗品費	消耗	12000	\N	3	2025-08-12 16:58:28.735	2025-08-12 16:58:28.735	22
30	終了分	ほか	396469	\N	7	2025-08-12 16:58:28.747	2025-08-12 16:58:28.747	30
31	学びフェス	固定	470000	\N	6	2025-08-12 16:58:28.749	2025-08-12 16:58:28.749	31
34	人件費	賃金	360000	\N	9	2025-08-12 16:58:28.755	2025-08-12 16:58:28.755	34
35	レンタカー	レンタカー	130000	\N	9	2025-08-12 16:58:28.757	2025-08-12 16:58:28.757	35
37	人件費（諸謝金）	賃金	120000	\N	9	2025-08-12 16:58:28.761	2025-08-12 16:58:28.761	37
33	生活必需品・学用品	消耗	310500	\N	9	2025-08-12 16:58:28.753	2025-08-13 16:36:53.754	33
11	光熱水費	いいい	342000	\N	1	2025-08-12 16:58:28.706	2025-08-14 15:06:54.211	11
36	ガソリン代	いぬ	10200	\N	9	2025-08-12 16:58:28.759	2025-08-21 10:35:43.114	36
\.


--
-- Data for Name: transactions; Type: TABLE DATA; Schema: public; Owner: nagaiku_user
--

COPY public.transactions (id, "journalNumber", "journalLineNumber", date, description, amount, account, supplier, item, memo, remark, department, "managementNumber", "freeDealId", "createdAt", "updatedAt", "detailDescription", "detailId", "receiptIds", tags) FROM stdin;
\.


--
-- Data for Name: allocation_splits; Type: TABLE DATA; Schema: public; Owner: nagaiku_user
--

COPY public.allocation_splits (id, "budgetItemId", amount, note, "createdAt", "updatedAt", "detailId") FROM stdin;
cmeh9ufja0000v2q7exvbmf5w	11	195	\N	2025-08-18 15:30:24.166	2025-08-18 15:30:24.166	\N
cmeh0ifv70000v2isbnrhwscz	33	81000	\N	2025-08-18 11:09:08.179	2025-08-18 11:09:08.179	\N
cmeh9ufja0001v2q7do5wmnh5	11	2900	\N	2025-08-18 15:30:24.166	2025-08-18 15:30:24.166	\N
cmeh0kehz0001v2isuoj8huzz	9	430	\N	2025-08-18 11:10:39.72	2025-08-18 11:10:39.72	\N
cmeh0n9nh0002v2iswy9mhf28	35	1413	\N	2025-08-18 11:12:53.406	2025-08-18 11:12:53.406	\N
cmeh9ufja0002v2q7w3vx6pzl	11	2915	\N	2025-08-18 15:30:24.166	2025-08-18 15:30:24.166	\N
cmeh9ufja0003v2q75kkb2fk6	11	2245	\N	2025-08-18 15:30:24.166	2025-08-18 15:30:24.166	\N
cmeh9ufja0004v2q7z5al12oy	11	430	\N	2025-08-18 15:30:24.166	2025-08-18 15:30:24.166	\N
cmeh9ufja0005v2q77w6o3ins	11	4267	\N	2025-08-18 15:30:24.166	2025-08-18 15:30:24.166	\N
cmeh9ufja0006v2q7zzntf1as	11	2680	\N	2025-08-18 15:30:24.166	2025-08-18 15:30:24.166	\N
cmeh9ufja0007v2q7mfynbh4m	11	9039	\N	2025-08-18 15:30:24.166	2025-08-18 15:30:24.166	\N
cmeh9v44g0008v2q712wfx90k	14	254	\N	2025-08-18 15:30:56.033	2025-08-18 15:30:56.033	\N
cmeh9v44g000av2q7ssg7lffv	14	24528	\N	2025-08-18 15:30:56.033	2025-08-18 15:30:56.033	\N
cmeh9v44g0009v2q76t82g0by	14	1752	\N	2025-08-18 15:30:56.033	2025-08-18 15:30:56.033	\N
cmeh9v44g000bv2q7uko70j6o	14	1500	\N	2025-08-18 15:30:56.033	2025-08-18 15:30:56.033	\N
\.


--
-- Data for Name: budget_schedules; Type: TABLE DATA; Schema: public; Owner: nagaiku_user
--

COPY public.budget_schedules (id, "budgetItemId", year, month, "isActive", "createdAt", "updatedAt", "monthlyBudget") FROM stdin;
317	9	2025	4	t	2025-08-13 19:22:09.498	2025-08-13 19:22:09.498	\N
318	9	2025	5	t	2025-08-13 19:22:09.498	2025-08-13 19:22:09.498	\N
348	33	2025	8	t	2025-08-13 16:36:53.823	2025-08-13 16:36:53.823	62100
349	33	2025	9	t	2025-08-13 16:36:53.823	2025-08-13 16:36:53.823	62100
350	33	2025	10	t	2025-08-13 16:36:53.823	2025-08-13 16:36:53.823	62100
351	33	2026	1	t	2025-08-13 16:36:53.823	2025-08-13 16:36:53.823	62100
352	33	2025	11	t	2025-08-13 16:36:53.823	2025-08-13 16:36:53.823	62100
353	11	2025	4	t	2025-08-14 15:06:54.326	2025-08-14 15:06:54.326	171000
354	11	2025	5	t	2025-08-14 15:06:54.326	2025-08-14 15:06:54.326	171000
\.


--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: nagaiku_user
--

COPY public.categories (id, name, type, color, "sortOrder", "isActive", "createdAt", "updatedAt") FROM stdin;
1	事業費	transaction	#10B981	1	t	2025-08-04 14:31:37.396	2025-08-04 14:31:37.396
2	事業活動費	budget_item	#8B5CF6	3	t	2025-08-04 14:31:37.397	2025-08-04 14:31:37.397
3	管理費	transaction	#3B82F6	2	t	2025-08-04 14:31:37.397	2025-08-04 14:31:37.397
4	物件費	budget_item	#F59E0B	2	t	2025-08-04 14:31:37.396	2025-08-04 14:31:37.396
5	人件費	budget_item	#EF4444	1	t	2025-08-04 14:31:37.397	2025-08-04 14:31:37.397
\.


--
-- Data for Name: freee_syncs; Type: TABLE DATA; Schema: public; Owner: nagaiku_user
--

COPY public.freee_syncs (id, "lastSyncAt", "syncStatus", "syncMessage", "recordCount", "createdAt", "updatedAt") FROM stdin;
40	2025-08-15 17:22:20.303	success	同期完了: 256件新規, 0件更新	256	2025-08-15 17:22:20.304	2025-08-15 17:22:21.523
41	2025-08-16 03:07:51.366	success	同期完了: 2669件新規, 0件更新	2669	2025-08-16 03:07:51.37	2025-08-16 03:08:07.075
42	2025-08-16 03:11:46.412	success	同期完了: 26件新規, 45件更新	71	2025-08-16 03:11:46.413	2025-08-16 03:11:46.855
\.


--
-- Data for Name: freee_tokens; Type: TABLE DATA; Schema: public; Owner: nagaiku_user
--

COPY public.freee_tokens (id, "accessToken", "refreshToken", "expiresAt", "tokenType", scope, "createdAt", "updatedAt") FROM stdin;
1	yngBOF4abchHF5GLJCFU-YSvh6N0zcM4JR2rNtgPMMs	BZcEXWAHc9REpNv-vLkxG8BDR0blDnRggQmRwIpipk4	2025-08-22 12:34:49.167	bearer	accounting:account_items:read accounting:account_items:write accounting:deals:read accounting:deals:write accounting:expense_application_templates:read accounting:expense_application_templates:write accounting:items:read accounting:items:write accounting:partners:read accounting:partners:write accounting:receipts:read accounting:reports_journals:read accounting:sections:read accounting:sections:write accounting:tags:read accounting:tags:write accounting:wallet_txns:read accounting:wallet_txns:write accounting:walletables:read default_read	2025-08-04 15:59:02.624	2025-08-22 06:34:49.167
\.


--
-- Name: budget_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: nagaiku_user
--

SELECT pg_catalog.setval('public.budget_items_id_seq', 91, true);


--
-- Name: budget_schedules_id_seq; Type: SEQUENCE SET; Schema: public; Owner: nagaiku_user
--

SELECT pg_catalog.setval('public.budget_schedules_id_seq', 358, true);


--
-- Name: categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: nagaiku_user
--

SELECT pg_catalog.setval('public.categories_id_seq', 5, true);


--
-- Name: freee_syncs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: nagaiku_user
--

SELECT pg_catalog.setval('public.freee_syncs_id_seq', 42, true);


--
-- Name: freee_tokens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: nagaiku_user
--

SELECT pg_catalog.setval('public.freee_tokens_id_seq', 1, true);


--
-- Name: grants_id_seq; Type: SEQUENCE SET; Schema: public; Owner: nagaiku_user
--

SELECT pg_catalog.setval('public.grants_id_seq', 71, true);


--
-- PostgreSQL database dump complete
--

