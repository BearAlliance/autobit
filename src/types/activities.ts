export interface Self {
  href: string;
}

export interface Links {
  self: Self[];
}

export interface User {
  name: string;
  emailAddress: string;
  id: number;
  displayName: string;
  active: boolean;
  slug: string;
  type: string;
  links: Links;
}

export interface Properties {
  repositoryId: number;
}

export interface Self2 {
  href: string;
}

export interface Links2 {
  self: Self2[];
}

export interface Author {
  name: string;
  emailAddress: string;
  id: number;
  displayName: string;
  active: boolean;
  slug: string;
  type: string;
  links: Links2;
}

export interface Properties2 {
  repositoryId: number;
}

export interface Self3 {
  href: string;
}

export interface Links3 {
  self: Self3[];
}

export interface Author2 {
  name: string;
  emailAddress: string;
  id: number;
  displayName: string;
  active: boolean;
  slug: string;
  type: string;
  links: Links3;
}

export interface PermittedOperations {
  editable: boolean;
  deletable: boolean;
}

export interface Comment2 {
  properties: Properties2;
  id: number;
  version: number;
  text: string;
  author: Author2;
  createdDate: number;
  updatedDate: number;
  comments: any[];
  tasks: any[];
  permittedOperations: PermittedOperations;
}

export interface PermittedOperations2 {
  editable: boolean;
  deletable: boolean;
}

export interface Comment {
  properties: Properties;
  id: number;
  version: number;
  text: string;
  author: Author;
  createdDate: any;
  updatedDate: any;
  comments: Comment2[];
  tasks: any[];
  permittedOperations: PermittedOperations2;
}

export interface CommentAnchor {
  fromHash: string;
  toHash: string;
  line: number;
  lineType: string;
  fileType: string;
  path: string;
  diffType: string;
  orphaned: boolean;
}

export interface Destination {
  components: string[];
  parent: string;
  name: string;
  extension: string;
  toString: string;
}

export interface Line {
  destination: number;
  source: number;
  line: string;
  truncated: boolean;
  commentIds: number[];
}

export interface Segment {
  type: string;
  lines: Line[];
  truncated: boolean;
}

export interface Hunk {
  sourceLine: number;
  sourceSpan: number;
  destinationLine: number;
  destinationSpan: number;
  segments: Segment[];
  truncated: boolean;
}

export interface Properties3 {
  current: boolean;
  fromHash: string;
  toHash: string;
}

export interface Diff {
  source?: any;
  destination: Destination;
  hunks: Hunk[];
  truncated: boolean;
  properties: Properties3;
}

export interface Activity {
  id: number;
  createdDate: any;
  user: User;
  action: string;
  commentAction: string;
  comment: Comment;
  commentAnchor: CommentAnchor;
  diff: Diff;
}

export interface Activities {
  size: number;
  limit: number;
  isLastPage: boolean;
  values: Activity[];
  start: number;
}
