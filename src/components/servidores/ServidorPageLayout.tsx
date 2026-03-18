import { Server } from "lucide-react";
import { ProviderCard, PanelsList } from "@/components/servidores/ProvedoresList";
import { AddPanelModal, EditPanelModal, TestResultModal, DeleteConfirmModal, SuccessModal, VerificationCodeModal, SearchUserModal } from "@/components/servidores/ServidoresModals";
import { useServidorPage } from "@/hooks/useServidorPage";
import { useEffect } from "react";

interface ServidorPageLayoutProps {
  providerId: string;
  title?: string;
}

export default function ServidorPageLayout({ providerId, title }: ServidorPageLayoutProps) {
  const {
    provider, panels, stats,
    isConfigModalOpen, setIsConfigModalOpen,
    showPassword, setShowPassword,
    autoRenewal, setAutoRenewal,
    isTestingConnection, testingPanelId,
    verifyingPanelId,
    checkingCreditsPanelId,
    formData, setFormData, validationError, editValidationError,
    testResultModal, setTestResultModal,
    createResultModal, setCreateResultModal,
    deleteConfirmModal, setDeleteConfirmModal,
    isEditModalOpen, setIsEditModalOpen,
    editForm, setEditForm,
    verificationModal, setVerificationModal,
    isSubmittingCode, isSendingCode,
    searchUserModal, setSearchUserModal,
    openAddPanel,
    handleCreatePanel, handleTestConnection,
    testPanel, startEditPanel, handleSaveEditPanel,
    handleToggleStatus, openDeleteConfirm, handleDeletePanel,
    handleVerifyPanel, handleSubmitVerificationCode, handleVincularPanel, handleSendVerifyCode,
    handleCheckCredits,
    openSearchUserModal, handleSearchUser,
  } = useServidorPage(providerId);

  useEffect(() => {
    document.title = `${title || provider?.nome || 'Servidor'} | Tech Play`;
  }, [title, provider]);

  if (!provider) {
    return (
      <main className="p-4">
        <p className="text-muted-foreground">Provedor não encontrado.</p>
      </main>
    );
  }

  return (
    <main className="space-y-4">
      {/* Header */}
      <header className="flex items-center justify-between p-4 rounded-lg bg-card border border-border">
        <div className="flex items-center gap-3">
          <Server className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-xl font-semibold text-foreground">{title || provider.nome}</h1>
            <p className="text-sm text-muted-foreground">{provider.descricao}</p>
          </div>
        </div>
      </header>

      {/* Provider Card with stats */}
      <ProviderCard provider={provider} stats={stats} />

      {/* Panels List */}
      {provider.integrado ? (
        <PanelsList
          panels={panels}
          providerName={provider.nome}
          providerId={providerId}
          testingPanelId={testingPanelId}
          verifyingPanelId={verifyingPanelId}
          checkingCreditsPanelId={checkingCreditsPanelId}
          onAddPanel={openAddPanel}
          onEditPanel={startEditPanel}
          onToggleStatus={handleToggleStatus}
          onTestPanel={testPanel}
          onDeletePanel={openDeleteConfirm}
          onVerifyPanel={undefined}
          onVincularPanel={undefined}
          onCheckCredits={undefined}
          onSearchUser={undefined}
        />
      ) : (
        <div className="rounded-lg p-8 bg-card border border-border text-center">
          <p className="text-muted-foreground">
            A integração com <span className="font-medium text-foreground">{provider.nome}</span> ainda não está disponível.
          </p>
        </div>
      )}

      {/* Modals */}
      <AddPanelModal
        isOpen={isConfigModalOpen}
        onOpenChange={setIsConfigModalOpen}
        providerName={provider.nome}
        providerConfig={provider}
        formData={formData}
        setFormData={setFormData}
        showPassword={showPassword}
        setShowPassword={setShowPassword}
        autoRenewal={autoRenewal}
        setAutoRenewal={setAutoRenewal}
        isTestingConnection={isTestingConnection}
        validationError={validationError}
        onCreatePanel={handleCreatePanel}
        onTestConnection={handleTestConnection}
      />

      <EditPanelModal
        isOpen={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        editForm={editForm}
        setEditForm={setEditForm}
        validationError={editValidationError}
        onSave={handleSaveEditPanel}
      />

      <TestResultModal
        isOpen={testResultModal.isOpen}
        onOpenChange={(open) => setTestResultModal(prev => ({ ...prev, isOpen: open }))}
        success={testResultModal.success}
        message={testResultModal.message}
        details={testResultModal.details}
      />

      <DeleteConfirmModal
        isOpen={deleteConfirmModal.isOpen}
        onOpenChange={(open) => setDeleteConfirmModal(prev => ({ ...prev, isOpen: open }))}
        panelName={deleteConfirmModal.panel?.nome || ''}
        onConfirm={handleDeletePanel}
      />

      <SuccessModal
        isOpen={createResultModal.isOpen}
        onOpenChange={(open) => setCreateResultModal(prev => ({ ...prev, isOpen: open }))}
        message={createResultModal.message}
        onClose={() => setIsConfigModalOpen(false)}
      />

      {/* UniTV Verification Code Modal */}
      <VerificationCodeModal
        isOpen={verificationModal.isOpen}
        onOpenChange={(open) => setVerificationModal(prev => ({ ...prev, isOpen: open }))}
        panelName={verificationModal.panelName}
        step={verificationModal.step}
        email={verificationModal.email}
        isSubmitting={isSubmittingCode}
        isSending={isSendingCode}
        onSendCode={handleSendVerifyCode}
        onSubmitCode={handleSubmitVerificationCode}
        onSkipToCode={() => setVerificationModal(prev => ({ ...prev, step: 'code' }))}
      />

      {/* Search User Modal (UniTV only) */}
      <SearchUserModal
        isOpen={searchUserModal.isOpen}
        onOpenChange={(open) => setSearchUserModal(prev => ({ ...prev, isOpen: open }))}
        panelName={searchUserModal.panelName}
        isSearching={searchUserModal.isSearching}
        result={searchUserModal.result}
        onSearch={handleSearchUser}
      />
    </main>
  );
}
