export interface Self {
  href: string;
}

export interface Links {
  self: Self[];
}

export interface Self2 {
  href: string;
}

export interface Links2 {
  self: Self2[];
}

export interface Owner {
  name: string;
  emailAddress: string;
  id: number;
  displayName: string;
  active: boolean;
  slug: string;
  type: string;
  links: Links2;
}

export interface Project {
  key: string;
  id: number;
  name: string;
  description: string;
  public: boolean;
  type: string;
  links: Links;
  owner: Owner;
}

export interface Clone {
  href: string;
  name: string;
}

export interface Self3 {
  href: string;
}

export interface Links3 {
  clone: Clone[];
  self: Self3[];
}

export interface Self4 {
  href: string;
}

export interface Links4 {
  self: Self4[];
}

export interface Project2 {
  key: string;
  id: number;
  name: string;
  description: string;
  public: boolean;
  type: string;
  links: Links4;
}

export interface Clone2 {
  href: string;
  name: string;
}

export interface Self5 {
  href: string;
}

export interface Links5 {
  clone: Clone2[];
  self: Self5[];
}

export interface Origin {
  slug: string;
  id: number;
  name: string;
  scmId: string;
  state: string;
  statusMessage: string;
  forkable: boolean;
  project: Project2;
  public: boolean;
  links: Links5;
}

export interface Repository {
  slug: string;
  id: number;
  name: string;
  scmId: string;
  state: string;
  statusMessage: string;
  forkable: boolean;
  project: Project;
  public: boolean;
  links: Links3;
  origin: Origin;
}

export interface FromRef {
  id: string;
  displayId: string;
  latestCommit: string;
  repository: Repository;
}

export interface Self6 {
  href: string;
}

export interface Links6 {
  self: Self6[];
}

export interface Self7 {
  href: string;
}

export interface Links7 {
  self: Self7[];
}

export interface Owner2 {
  name: string;
  emailAddress: string;
  id: number;
  displayName: string;
  active: boolean;
  slug: string;
  type: string;
  links: Links7;
}

export interface Project3 {
  key: string;
  id: number;
  name: string;
  description: string;
  public: boolean;
  type: string;
  links: Links6;
  owner: Owner2;
}

export interface Clone3 {
  href: string;
  name: string;
}

export interface Self8 {
  href: string;
}

export interface Links8 {
  clone: Clone3[];
  self: Self8[];
}

export interface Self9 {
  href: string;
}

export interface Links9 {
  self: Self9[];
}

export interface Project4 {
  key: string;
  id: number;
  name: string;
  description: string;
  public: boolean;
  type: string;
  links: Links9;
}

export interface Clone4 {
  href: string;
  name: string;
}

export interface Self10 {
  href: string;
}

export interface Links10 {
  clone: Clone4[];
  self: Self10[];
}

export interface Origin2 {
  slug: string;
  id: number;
  name: string;
  scmId: string;
  state: string;
  statusMessage: string;
  forkable: boolean;
  project: Project4;
  public: boolean;
  links: Links10;
}

export interface Repository2 {
  slug: string;
  id: number;
  name: string;
  scmId: string;
  state: string;
  statusMessage: string;
  forkable: boolean;
  project: Project3;
  public: boolean;
  links: Links8;
  origin: Origin2;
}

export interface ToRef {
  id: string;
  displayId: string;
  latestCommit: string;
  repository: Repository2;
}

export interface Self11 {
  href: string;
}

export interface Links11 {
  self: Self11[];
}

export interface User {
  name: string;
  emailAddress: string;
  id: number;
  displayName: string;
  active: boolean;
  slug: string;
  type: string;
  links: Links11;
}

export interface Author {
  user: User;
  role: string;
  approved: boolean;
  status: string;
}

export interface Self12 {
  href: string;
}

export interface Links12 {
  self: Self12[];
}

export interface User2 {
  name: string;
  emailAddress: string;
  id: number;
  displayName: string;
  active: boolean;
  slug: string;
  type: string;
  links: Links12;
}

export interface Reviewer {
  user: User2;
  role: string;
  approved: boolean;
  status: string;
  lastReviewedCommit: string;
}

export interface Self13 {
  href: string;
}

export interface Links13 {
  self: Self13[];
}

export interface User3 {
  name: string;
  emailAddress: string;
  id: number;
  displayName: string;
  active: boolean;
  slug: string;
  type: string;
  links: Links13;
}

export interface Participant {
  user: User3;
  role: string;
  approved: boolean;
  status: string;
}

export interface MergeResult {
  outcome: string;
  current: boolean;
}

export interface Properties {
  commentCount: number;
  openTaskCount: number;
  resolvedTaskCount: number;
  mergeResult: MergeResult;
}

export interface Self14 {
  href: string;
}

export interface Links14 {
  self: Self14[];
}

export interface Value {
  id: number;
  version: number;
  title: string;
  description: string;
  state: string;
  open: boolean;
  closed: boolean;
  createdDate: any;
  updatedDate: any;
  fromRef: FromRef;
  toRef: ToRef;
  locked: boolean;
  author: Author;
  reviewers: Reviewer[];
  participants: Participant[];
  properties: Properties;
  links: Links14;
}

export interface Prs {
  size: number;
  limit: number;
  isLastPage: boolean;
  values: Value[];
  start: number;
}

