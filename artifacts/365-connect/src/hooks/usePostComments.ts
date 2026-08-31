import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export type PostComment = {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  created_at: string;
  author_username: string | null;
  author_photo_url: string | null;
};

export function usePostComments(postId?: string) {
  const q = useQuery({
    queryKey: ['comments', postId],
    enabled: !!postId,
    queryFn: () => apiClient(null).get<PostComment[]>(`/posts/${postId}/comments`),
  });
  return { comments: q.data ?? [], isLoading: q.isLoading, refetch: q.refetch };
}

export function useAddComment(postId?: string) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      apiClient(user!.id).post<PostComment>(`/posts/${postId}/comments`, { body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comments', postId] });
      qc.invalidateQueries({ queryKey: ['post', postId] });
      qc.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}
