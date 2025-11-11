import React, { useState } from 'react';
import Button from './Button';

const FeedbackForm = ({ user, onSubmit, notificationId, className = '' }) => {
  const [formData, setFormData] = useState({
    comment: '',
    rating: null,
    status: 'pending' // pending, resolved, false_positive
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError('');
  };

  const handleRatingClick = (rating) => {
    setFormData((prev) => ({
      ...prev,
      rating: rating,
    }));
    setError('');
  };

  const handleStatusChange = (status) => {
    setFormData((prev) => ({
      ...prev,
      status: status,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    // Validate form
    if (!formData.comment.trim()) {
      setError('Please provide a comment');
      return;
    }

    if (!formData.status) {
      setError('Please select a status for this violation');
      return;
    }

    setIsSubmitting(true);

    try {
      // Call the onSubmit prop if provided
      if (onSubmit) {
        await onSubmit({
          ...formData,
          notificationId,
          userId: user?.id || user?.email,
          userName: user?.name || user?.email,
          timestamp: new Date().toISOString(),
        });
      } else {
        // Default submission logic (mock)
        await new Promise((resolve) => setTimeout(resolve, 1000));
        console.log('Feedback submitted:', {
          ...formData,
          notificationId,
          user,
        });
      }

      setSuccess(true);
      
      // Reset form after successful submission
      setTimeout(() => {
        setFormData({
          comment: '',
          rating: null,
          status: 'pending',
        });
        setSuccess(false);
      }, 2000);
    } catch (err) {
      setError(err.message || 'Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`w-full bg-white rounded-lg border border-gray-200 shadow-sm ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
        <h2 className="text-lg font-semibold text-gray-900">Violation Feedback</h2>
        <p className="text-sm text-gray-500 mt-1">Provide feedback on this violation incident</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* Status Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Violation Status <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => handleStatusChange('pending')}
              className={`
                px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all
                ${
                  formData.status === 'pending'
                    ? 'border-yellow-500 bg-yellow-50 text-yellow-900'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }
              `}
            >
              <div className="flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-yellow-500 mr-2" />
                Pending Review
              </div>
            </button>
            <button
              type="button"
              onClick={() => handleStatusChange('resolved')}
              className={`
                px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all
                ${
                  formData.status === 'resolved'
                    ? 'border-green-500 bg-green-50 text-green-900'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }
              `}
            >
              <div className="flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-green-500 mr-2" />
                Resolved
              </div>
            </button>
            <button
              type="button"
              onClick={() => handleStatusChange('false_positive')}
              className={`
                px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all
                ${
                  formData.status === 'false_positive'
                    ? 'border-red-500 bg-red-50 text-red-900'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }
              `}
            >
              <div className="flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-red-500 mr-2" />
                False Positive
              </div>
            </button>
          </div>
        </div>

        {/* Rating (Optional) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Severity Rating (Optional)
          </label>
          <div className="flex items-center space-x-2">
            {[1, 2, 3, 4, 5].map((rating) => (
              <button
                key={rating}
                type="button"
                onClick={() => handleRatingClick(rating)}
                className={`
                  w-10 h-10 rounded-lg border-2 flex items-center justify-center
                  transition-all font-semibold
                  ${
                    formData.rating === rating
                      ? 'border-blue-500 bg-blue-50 text-blue-900'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }
                `}
              >
                {rating}
              </button>
            ))}
            {formData.rating && (
              <span className="ml-2 text-sm text-gray-500">
                {formData.rating === 1 && 'Low'}
                {formData.rating === 2 && 'Low-Medium'}
                {formData.rating === 3 && 'Medium'}
                {formData.rating === 4 && 'Medium-High'}
                {formData.rating === 5 && 'High'}
              </span>
            )}
          </div>
        </div>

        {/* Comment */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Comments <span className="text-red-500">*</span>
          </label>
          <textarea
            name="comment"
            value={formData.comment}
            onChange={handleInputChange}
            rows={4}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
            placeholder="Enter your feedback or comments about this violation..."
            required
          />
          <p className="mt-1 text-xs text-gray-500">
            {formData.comment.length} characters
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-600">Feedback submitted successfully!</p>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end">
          <Button
            type="submit"
            variant="primary"
            size="default"
            disabled={isSubmitting || !formData.comment.trim() || !formData.status}
            className="min-w-[120px]"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default FeedbackForm;

