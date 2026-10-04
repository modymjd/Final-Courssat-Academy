export interface NoteBlock {
  id: string;
  type: "heading" | "text" | "checklist" | "code" | "timestamp";
  content: string;
  timestampSeconds?: number;
  checked?: boolean;
}

export interface StudentNote {
  id: number;
  client_id?: string;
  course_id?: number | null;
  course_title?: string;
  lesson_id?: number | null;
  lesson_title?: string;
  title: string;
  content: string;
  timestamp_seconds?: number | null;
  tags: string[];
  color: string;
  is_pinned: boolean;
  blocks: NoteBlock[];
  created_at: string;
  updated_at: string;
}

export interface StudentNoteCreateInput {
  client_id?: string;
  course_id?: number | null;
  lesson_id?: number | null;
  title?: string;
  content?: string;
  timestamp_seconds?: number | null;
  tags?: string[];
  color?: string;
  is_pinned?: boolean;
  blocks?: NoteBlock[];
  created_at?: string;
}

export interface StudentNoteUpdateInput {
  course_id?: number | null;
  lesson_id?: number | null;
  title?: string;
  content?: string;
  timestamp_seconds?: number | null;
  tags?: string[];
  color?: string;
  is_pinned?: boolean;
  blocks?: NoteBlock[];
}

export interface BulkImportNotesResponse {
  status: string;
  imported_count: number;
  mapping: Record<string, number>;
}
