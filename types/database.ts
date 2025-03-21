export interface Model {
  id: number;
  title: string;
  description: string;
  price: number;
  preview_image_url: string | null;
  model_url: string | null;
  category: string;
  downloads?: number;
  likes?: number;
  isLiked?: boolean;
  tags?: string[];
  created_at?: string;
  user_id?: string;
}