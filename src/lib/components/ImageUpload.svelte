<script lang="ts">
  interface Props {
    value?: string
    onchange: (imageData: string | undefined) => void
  }

  let { value, onchange }: Props = $props()

  let fileInput: HTMLInputElement | null = null
  let dragOver = $state(false)

  function handleFileSelect(file: File) {
    if (!file.type.startsWith('image/')) {
      alert('Veuillez sélectionner une image')
      return
    }

    // Limit to 2MB to avoid huge JSON files
    if (file.size > 2 * 1024 * 1024) {
      alert('L\'image est trop volumineuse (max 2 Mo)')
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      // Compress if needed by drawing to canvas
      compressImage(result, 800, 0.8).then(compressed => {
        onchange(compressed)
      })
    }
    reader.readAsDataURL(file)
  }

  function compressImage(dataUrl: string, maxWidth: number, quality: number): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height

        if (width > maxWidth) {
          height = (height * maxWidth) / width
          width = maxWidth
        }

        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        ctx?.drawImage(img, 0, 0, width, height)

        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.src = dataUrl
    })
  }

  function handleInputChange(e: Event) {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    dragOver = false
    const file = e.dataTransfer?.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault()
    dragOver = true
  }

  function handleDragLeave() {
    dragOver = false
  }

  function removeImage() {
    onchange(undefined)
    if (fileInput) {
      fileInput.value = ''
    }
  }

  function triggerFileSelect() {
    fileInput?.click()
  }
</script>

<div class="image-upload">
  <input
    bind:this={fileInput}
    type="file"
    accept="image/*"
    onchange={handleInputChange}
    class="file-input"
  />

  {#if value}
    <div class="preview-container">
      <img src={value} alt="Aperçu" class="preview-image" />
      <div class="preview-actions">
        <button type="button" class="btn-change" onclick={triggerFileSelect}>
          Changer
        </button>
        <button type="button" class="btn-remove-image" onclick={removeImage}>
          Supprimer
        </button>
      </div>
    </div>
  {:else}
    <button
      type="button"
      class="drop-zone"
      class:drag-over={dragOver}
      onclick={triggerFileSelect}
      ondrop={handleDrop}
      ondragover={handleDragOver}
      ondragleave={handleDragLeave}
    >
      <span class="drop-icon">📷</span>
      <span class="drop-text">Cliquez ou glissez une image</span>
      <span class="drop-hint">JPG, PNG (max 2 Mo)</span>
    </button>
  {/if}
</div>

<style>
  .image-upload {
    width: 100%;
  }

  .file-input {
    display: none;
  }

  .drop-zone {
    width: 100%;
    padding: 2rem 1rem;
    border: 2px dashed #ddd;
    border-radius: 8px;
    background: #fafafa;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    transition: all 0.2s;
  }

  .drop-zone:hover, .drop-zone.drag-over {
    border-color: #10b981;
    background: #f0fdf4;
  }

  .drop-icon {
    font-size: 2rem;
  }

  .drop-text {
    color: #666;
    font-size: 0.95rem;
  }

  .drop-hint {
    color: #999;
    font-size: 0.8rem;
  }

  .preview-container {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
  }

  .preview-image {
    max-width: 100%;
    max-height: 200px;
    border-radius: 8px;
    object-fit: cover;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .preview-actions {
    display: flex;
    gap: 0.5rem;
  }

  .btn-change, .btn-remove-image {
    padding: 0.5rem 1rem;
    border-radius: 6px;
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-change {
    background: #f3f4f6;
    border: 1px solid #ddd;
    color: #333;
  }

  .btn-change:hover {
    background: #e5e7eb;
  }

  .btn-remove-image {
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: #dc2626;
  }

  .btn-remove-image:hover {
    background: #fee2e2;
  }
</style>
