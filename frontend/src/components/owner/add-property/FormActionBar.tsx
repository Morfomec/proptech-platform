import React from 'react'

export interface FormActionBarProps {
  isEditMode: boolean
  listingStatus: string | null
  isSubmitting: boolean
  submittingAction: 'publish' | 'draft' | null
  imageCount: number
  onCancel: () => void
  onSubmit: (wantsPublish: boolean) => void
}

export const FormActionBar: React.FC<FormActionBarProps> = ({
  isEditMode,
  listingStatus,
  isSubmitting,
  submittingAction,
  imageCount,
  onCancel,
  onSubmit,
}) => {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-gray-200">
      <div className="text-xs text-gray-500 self-start sm:self-auto">
        {imageCount > 0 ? (
          <span className="text-[#34745C] font-medium">
            {imageCount} photo(s) selected
          </span>
        ) : (
          <span className="text-gray-500">
            At least 1 photo is required to publish
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
        <button
          type="button"
          disabled={isSubmitting}
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 rounded-lg transition-colors cursor-pointer disabled:opacity-50 shadow-2xs"
        >
          Cancel
        </button>

        {isEditMode ? (
          <>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => onSubmit(false)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-50 ${
                listingStatus !== 'draft' && listingStatus !== null
                  ? 'bg-[#408A71] hover:bg-[#34745C] text-white shadow-2xs'
                  : 'border border-gray-300 hover:bg-gray-50 text-gray-700'
              }`}
            >
              {isSubmitting && submittingAction === 'draft' ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  <span>Saving Changes...</span>
                </span>
              ) : (
                <span>Save Changes</span>
              )}
            </button>

            {(listingStatus === 'draft' || listingStatus === null) && (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => onSubmit(true)}
                className="px-5 py-2 text-sm font-medium bg-[#408A71] hover:bg-[#34745C] text-white rounded-lg transition-colors shadow-2xs cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                {isSubmitting && submittingAction === 'publish' ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Publishing...</span>
                  </>
                ) : (
                  <span>Save & Publish</span>
                )}
              </button>
            )}
          </>
        ) : (
          <>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => onSubmit(false)}
              className="px-4 py-2 text-sm font-medium border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSubmitting && submittingAction === 'draft' ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
                  <span>Saving Draft...</span>
                </span>
              ) : (
                <span>Save as Draft</span>
              )}
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => onSubmit(true)}
              className="px-5 py-2 text-sm font-medium bg-[#408A71] hover:bg-[#34745C] text-white rounded-lg transition-colors shadow-2xs cursor-pointer disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting && submittingAction === 'publish' ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Publishing...</span>
                </>
              ) : (
                <span>Save & Publish</span>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default FormActionBar

