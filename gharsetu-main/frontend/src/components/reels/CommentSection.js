import React from 'react';
import { User } from 'lucide-react';

const CommentSection = React.memo(({ comments }) => {
  if (!comments.length) {
    return <p className="text-center text-gray-400 py-8">No comments yet. Be the first!</p>;
  }

  return comments.map((comment) => (
    <div key={comment.id} className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
        <User className="w-4 h-4 text-gray-500" />
      </div>
      <div className="flex-1">
        <p className="text-sm">
          <span className="font-semibold">{comment.user_name || 'User'}</span>
          {' '}{comment.comment}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          {new Date(comment.created_at).toLocaleDateString()}
        </p>
      </div>
    </div>
  ));
});

export default CommentSection;
