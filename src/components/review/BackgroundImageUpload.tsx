interface BackgroundImageUploadProps {
  backgroundImage: string | null;
  onImageChange: (image: string | null) => void;
}

export function BackgroundImageUpload({
  backgroundImage,
  onImageChange
}: BackgroundImageUploadProps) {
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      onImageChange(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex items-center gap-4">
      <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50">
        <input
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />
        <span>背景画像を追加</span>
      </label>

      {backgroundImage && (
        <>
          <div className="h-16 w-16 overflow-hidden rounded-lg border">
            <img
              src={backgroundImage}
              alt="背景プレビュー"
              className="h-full w-full object-cover"
            />
          </div>
          <button
            onClick={() => onImageChange(null)}
            className="text-sm text-red-600 hover:text-red-800 hover:underline"
          >
            クリア
          </button>
        </>
      )}
    </div>
  );
}
