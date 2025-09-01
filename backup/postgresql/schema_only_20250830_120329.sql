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

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: allocation_splits; Type: TABLE; Schema: public; Owner: nagaiku_user
--

CREATE TABLE public.allocation_splits (
    id text NOT NULL,
    "budgetItemId" integer NOT NULL,
    amount integer NOT NULL,
    note text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "detailId" bigint
);


ALTER TABLE public.allocation_splits OWNER TO nagaiku_user;

--
-- Name: budget_items; Type: TABLE; Schema: public; Owner: nagaiku_user
--

CREATE TABLE public.budget_items (
    id integer NOT NULL,
    name text NOT NULL,
    category text,
    "budgetedAmount" integer,
    note text,
    "grantId" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.budget_items OWNER TO nagaiku_user;

--
-- Name: budget_items_id_seq; Type: SEQUENCE; Schema: public; Owner: nagaiku_user
--

CREATE SEQUENCE public.budget_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.budget_items_id_seq OWNER TO nagaiku_user;

--
-- Name: budget_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: nagaiku_user
--

ALTER SEQUENCE public.budget_items_id_seq OWNED BY public.budget_items.id;


--
-- Name: budget_schedules; Type: TABLE; Schema: public; Owner: nagaiku_user
--

CREATE TABLE public.budget_schedules (
    id integer NOT NULL,
    "budgetItemId" integer NOT NULL,
    year integer NOT NULL,
    month integer NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "monthlyBudget" integer
);


ALTER TABLE public.budget_schedules OWNER TO nagaiku_user;

--
-- Name: budget_schedules_id_seq; Type: SEQUENCE; Schema: public; Owner: nagaiku_user
--

CREATE SEQUENCE public.budget_schedules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.budget_schedules_id_seq OWNER TO nagaiku_user;

--
-- Name: budget_schedules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: nagaiku_user
--

ALTER SEQUENCE public.budget_schedules_id_seq OWNED BY public.budget_schedules.id;


--
-- Name: categories; Type: TABLE; Schema: public; Owner: nagaiku_user
--

CREATE TABLE public.categories (
    id integer NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    color text,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.categories OWNER TO nagaiku_user;

--
-- Name: categories_id_seq; Type: SEQUENCE; Schema: public; Owner: nagaiku_user
--

CREATE SEQUENCE public.categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.categories_id_seq OWNER TO nagaiku_user;

--
-- Name: categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: nagaiku_user
--

ALTER SEQUENCE public.categories_id_seq OWNED BY public.categories.id;


--
-- Name: freee_syncs; Type: TABLE; Schema: public; Owner: nagaiku_user
--

CREATE TABLE public.freee_syncs (
    id integer NOT NULL,
    "lastSyncAt" timestamp(3) without time zone NOT NULL,
    "syncStatus" text DEFAULT 'idle'::text NOT NULL,
    "syncMessage" text,
    "recordCount" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.freee_syncs OWNER TO nagaiku_user;

--
-- Name: freee_syncs_id_seq; Type: SEQUENCE; Schema: public; Owner: nagaiku_user
--

CREATE SEQUENCE public.freee_syncs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.freee_syncs_id_seq OWNER TO nagaiku_user;

--
-- Name: freee_syncs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: nagaiku_user
--

ALTER SEQUENCE public.freee_syncs_id_seq OWNED BY public.freee_syncs.id;


--
-- Name: freee_tokens; Type: TABLE; Schema: public; Owner: nagaiku_user
--

CREATE TABLE public.freee_tokens (
    id integer NOT NULL,
    "accessToken" text NOT NULL,
    "refreshToken" text NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "tokenType" text DEFAULT 'Bearer'::text NOT NULL,
    scope text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.freee_tokens OWNER TO nagaiku_user;

--
-- Name: freee_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: nagaiku_user
--

CREATE SEQUENCE public.freee_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.freee_tokens_id_seq OWNER TO nagaiku_user;

--
-- Name: freee_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: nagaiku_user
--

ALTER SEQUENCE public.freee_tokens_id_seq OWNED BY public.freee_tokens.id;


--
-- Name: grants; Type: TABLE; Schema: public; Owner: nagaiku_user
--

CREATE TABLE public.grants (
    id integer NOT NULL,
    name text NOT NULL,
    "grantCode" text,
    "totalAmount" integer,
    "startDate" timestamp(3) without time zone,
    "endDate" timestamp(3) without time zone,
    status text DEFAULT 'active'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.grants OWNER TO nagaiku_user;

--
-- Name: grants_id_seq; Type: SEQUENCE; Schema: public; Owner: nagaiku_user
--

CREATE SEQUENCE public.grants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.grants_id_seq OWNER TO nagaiku_user;

--
-- Name: grants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: nagaiku_user
--

ALTER SEQUENCE public.grants_id_seq OWNED BY public.grants.id;


--
-- Name: transactions; Type: TABLE; Schema: public; Owner: nagaiku_user
--

CREATE TABLE public.transactions (
    id text NOT NULL,
    "journalNumber" bigint NOT NULL,
    "journalLineNumber" integer NOT NULL,
    date timestamp(3) without time zone NOT NULL,
    description text,
    amount integer NOT NULL,
    account text,
    supplier text,
    item text,
    memo text,
    remark text,
    department text,
    "managementNumber" text,
    "freeDealId" bigint,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "detailDescription" text,
    "detailId" bigint NOT NULL,
    "receiptIds" text,
    tags text
);


ALTER TABLE public.transactions OWNER TO nagaiku_user;

--
-- Name: budget_items id; Type: DEFAULT; Schema: public; Owner: nagaiku_user
--

ALTER TABLE ONLY public.budget_items ALTER COLUMN id SET DEFAULT nextval('public.budget_items_id_seq'::regclass);


--
-- Name: budget_schedules id; Type: DEFAULT; Schema: public; Owner: nagaiku_user
--

ALTER TABLE ONLY public.budget_schedules ALTER COLUMN id SET DEFAULT nextval('public.budget_schedules_id_seq'::regclass);


--
-- Name: categories id; Type: DEFAULT; Schema: public; Owner: nagaiku_user
--

ALTER TABLE ONLY public.categories ALTER COLUMN id SET DEFAULT nextval('public.categories_id_seq'::regclass);


--
-- Name: freee_syncs id; Type: DEFAULT; Schema: public; Owner: nagaiku_user
--

ALTER TABLE ONLY public.freee_syncs ALTER COLUMN id SET DEFAULT nextval('public.freee_syncs_id_seq'::regclass);


--
-- Name: freee_tokens id; Type: DEFAULT; Schema: public; Owner: nagaiku_user
--

ALTER TABLE ONLY public.freee_tokens ALTER COLUMN id SET DEFAULT nextval('public.freee_tokens_id_seq'::regclass);


--
-- Name: grants id; Type: DEFAULT; Schema: public; Owner: nagaiku_user
--

ALTER TABLE ONLY public.grants ALTER COLUMN id SET DEFAULT nextval('public.grants_id_seq'::regclass);


--
-- Name: allocation_splits allocation_splits_pkey; Type: CONSTRAINT; Schema: public; Owner: nagaiku_user
--

ALTER TABLE ONLY public.allocation_splits
    ADD CONSTRAINT allocation_splits_pkey PRIMARY KEY (id);


--
-- Name: budget_items budget_items_pkey; Type: CONSTRAINT; Schema: public; Owner: nagaiku_user
--

ALTER TABLE ONLY public.budget_items
    ADD CONSTRAINT budget_items_pkey PRIMARY KEY (id);


--
-- Name: budget_schedules budget_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: nagaiku_user
--

ALTER TABLE ONLY public.budget_schedules
    ADD CONSTRAINT budget_schedules_pkey PRIMARY KEY (id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: nagaiku_user
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: freee_syncs freee_syncs_pkey; Type: CONSTRAINT; Schema: public; Owner: nagaiku_user
--

ALTER TABLE ONLY public.freee_syncs
    ADD CONSTRAINT freee_syncs_pkey PRIMARY KEY (id);


--
-- Name: freee_tokens freee_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: nagaiku_user
--

ALTER TABLE ONLY public.freee_tokens
    ADD CONSTRAINT freee_tokens_pkey PRIMARY KEY (id);


--
-- Name: grants grants_pkey; Type: CONSTRAINT; Schema: public; Owner: nagaiku_user
--

ALTER TABLE ONLY public.grants
    ADD CONSTRAINT grants_pkey PRIMARY KEY (id);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: nagaiku_user
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: budget_schedules_budgetItemId_year_month_key; Type: INDEX; Schema: public; Owner: nagaiku_user
--

CREATE UNIQUE INDEX "budget_schedules_budgetItemId_year_month_key" ON public.budget_schedules USING btree ("budgetItemId", year, month);


--
-- Name: categories_name_key; Type: INDEX; Schema: public; Owner: nagaiku_user
--

CREATE UNIQUE INDEX categories_name_key ON public.categories USING btree (name);


--
-- Name: idx_budget_items_category; Type: INDEX; Schema: public; Owner: nagaiku_user
--

CREATE INDEX idx_budget_items_category ON public.budget_items USING btree (category) WHERE (category IS NOT NULL);


--
-- Name: idx_budget_schedules_active; Type: INDEX; Schema: public; Owner: nagaiku_user
--

CREATE INDEX idx_budget_schedules_active ON public.budget_schedules USING btree ("isActive") WHERE ("isActive" = true);


--
-- Name: idx_grants_dates; Type: INDEX; Schema: public; Owner: nagaiku_user
--

CREATE INDEX idx_grants_dates ON public.grants USING btree ("startDate", "endDate") WHERE (("startDate" IS NOT NULL) AND ("endDate" IS NOT NULL));


--
-- Name: idx_grants_grant_code; Type: INDEX; Schema: public; Owner: nagaiku_user
--

CREATE INDEX idx_grants_grant_code ON public.grants USING btree ("grantCode") WHERE ("grantCode" IS NOT NULL);


--
-- Name: idx_transactions_freedealid; Type: INDEX; Schema: public; Owner: nagaiku_user
--

CREATE INDEX idx_transactions_freedealid ON public.transactions USING btree ("freeDealId") WHERE ("freeDealId" IS NOT NULL);


--
-- Name: transactions_detailId_key; Type: INDEX; Schema: public; Owner: nagaiku_user
--

CREATE UNIQUE INDEX "transactions_detailId_key" ON public.transactions USING btree ("detailId");


--
-- Name: transactions_freeDealId_key; Type: INDEX; Schema: public; Owner: nagaiku_user
--

CREATE UNIQUE INDEX "transactions_freeDealId_key" ON public.transactions USING btree ("freeDealId");


--
-- Name: allocation_splits allocation_splits_budgetItemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nagaiku_user
--

ALTER TABLE ONLY public.allocation_splits
    ADD CONSTRAINT "allocation_splits_budgetItemId_fkey" FOREIGN KEY ("budgetItemId") REFERENCES public.budget_items(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: allocation_splits allocation_splits_detailId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nagaiku_user
--

ALTER TABLE ONLY public.allocation_splits
    ADD CONSTRAINT "allocation_splits_detailId_fkey" FOREIGN KEY ("detailId") REFERENCES public.transactions("detailId") ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: budget_items budget_items_grantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nagaiku_user
--

ALTER TABLE ONLY public.budget_items
    ADD CONSTRAINT "budget_items_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES public.grants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: budget_schedules budget_schedules_budgetItemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nagaiku_user
--

ALTER TABLE ONLY public.budget_schedules
    ADD CONSTRAINT "budget_schedules_budgetItemId_fkey" FOREIGN KEY ("budgetItemId") REFERENCES public.budget_items(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT ALL ON SCHEMA public TO nagaiku_user;


--
-- PostgreSQL database dump complete
--

