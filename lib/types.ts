export type UserRole =
  | "truong_phong"
  | "pho_phong"
  | "doi_truong"
  | "doi_pho"
  | "can_bo";

export type TaskStatus =
  | "pending"
  | "in_progress"
  | "review"
  | "completed"
  | "cancelled";

export type PriorityLevel = "low" | "medium" | "high" | "urgent";

export type Profile = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  role: UserRole;
  department_id?: string | null;
  team_id?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type Task = {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: PriorityLevel;
  due_date?: string | null;
  rating?: number | null;
  review_comment?: string | null;

  department_id?: string | null;
  team_id?: string | null;
  workspace_id?: string | null;

  created_by?: string | null;
  assigned_to?: string | null;

  created_at?: string;
  updated_at?: string;
};

export type TaskAttachment = {
  id: string;
  task_id: string;
  uploader_id?: string | null;
  storage_path: string;
  file_name?: string | null;
  mime_type?: string | null;
  size_bytes?: number | null;
  created_at?: string;
};

export type TaskComment = {
  id: string;
  task_id: string;
  author_id?: string | null;
  attachment_id?: string | null;
  content: string;
  created_at?: string;
  author?: {
    full_name?: string | null;
    email?: string | null;
    role?: UserRole;
  } | null;
  attachment?: (TaskAttachment & { url?: string | null }) | null;
};

export type Team = {
  id: string;
  department_id?: string | null;
  name: string;
  join_code?: string;
  created_at?: string;
};

export type Workspace = {
  id: string;
  name: string;
  owner_id?: string | null;
  created_at?: string;
  my_role?: UserRole; // computed by API
};

export type WorkspaceMember = {
  workspace_id: string;
  user_id: string;
  role: UserRole;
  created_at?: string;
  user?: {
    id: string;
    email?: string | null;
    full_name?: string | null;
    role?: UserRole;
  } | null;
};

export type Notification = {
  id: string;
  user_id: string;
  title: string;
  body?: string | null;
  read_at?: string | null;
  created_at?: string;
};


